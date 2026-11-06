from calendar import monthrange
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from celery import shared_task
from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import Report, ScheduledJobRun, Store, StoreSettings
from .services import ReportService, SMSService


def due(local_now, scheduled_time):
    return (local_now.hour, local_now.minute) >= (scheduled_time.hour, scheduled_time.minute)


def _claim_scheduled_run(*, store, job_type, period_key):
    """Create one durable queue claim before dispatch, so the minute poller is idempotent."""
    try:
        return ScheduledJobRun.objects.create(
            store=store,
            job_type=job_type,
            period_key=period_key,
            status=ScheduledJobRun.Status.QUEUED,
        )
    except IntegrityError:
        return None


def _start_scheduled_run(*, store, job_type, period_key, run_id=None):
    """Atomically let only one queued delivery begin the scheduled work."""
    with transaction.atomic():
        if run_id is None:
            run = _claim_scheduled_run(store=store, job_type=job_type, period_key=period_key)
            if run is None:
                return None
            run = ScheduledJobRun.objects.select_for_update().get(pk=run.pk)
        else:
            run = ScheduledJobRun.objects.select_for_update().filter(
                pk=run_id,
                store=store,
                job_type=job_type,
                period_key=period_key,
            ).first()
            if run is None:
                return None
        if run.status != ScheduledJobRun.Status.QUEUED:
            return None
        run.status = ScheduledJobRun.Status.STARTED
        run.save(update_fields=["status"])
        return run


def _mark_failed(run, exc):
    run.status = ScheduledJobRun.Status.FAILED
    run.error_message = str(exc)
    run.completed_at = timezone.now()
    run.save(update_fields=["status", "error_message", "completed_at"])


def _dispatch_once(*, store, job_type, period_key, task, args, synchronous):
    run = _claim_scheduled_run(store=store, job_type=job_type, period_key=period_key)
    if run is None:
        return False
    try:
        if synchronous:
            task(*args, run_id=run.id)
        else:
            task.delay(*args, run_id=run.id)
    except Exception as exc:
        _mark_failed(run, exc)
        raise
    return True


@shared_task
def dispatch_scheduled_jobs(synchronous=False):
    """Dispatch due jobs. Synchronous mode supports local acceptance testing without Redis."""
    dispatched = 0

    for store_settings in StoreSettings.objects.select_related("store").filter(store__is_active=True):
        local_now = timezone.now().astimezone(ZoneInfo(store_settings.store.timezone))
        today = local_now.date()
        if store_settings.sms_enabled and due(local_now, store_settings.sms_reminder_time):
            dispatched += _dispatch_once(
                store=store_settings.store,
                job_type=ScheduledJobRun.JobType.DEBT_SMS,
                period_key=str(today),
                task=run_debt_sms,
                args=(store_settings.store_id, str(today)),
                synchronous=synchronous,
            )
        if store_settings.automated_reports_enabled and due(local_now, store_settings.daily_report_time):
            dispatched += _dispatch_once(
                store=store_settings.store,
                job_type=ScheduledJobRun.JobType.DAILY_REPORT,
                period_key=str(today),
                task=run_report,
                args=(store_settings.store_id, Report.ReportType.DAILY, str(today), str(today), str(today)),
                synchronous=synchronous,
            )
        if (
            store_settings.automated_reports_enabled
            and local_now.weekday() == store_settings.weekly_report_day
            and due(local_now, store_settings.weekly_report_time)
        ):
            period_start = today - timedelta(days=6)
            dispatched += _dispatch_once(
                store=store_settings.store,
                job_type=ScheduledJobRun.JobType.WEEKLY_REPORT,
                period_key=str(today),
                task=run_report,
                args=(store_settings.store_id, Report.ReportType.WEEKLY, str(period_start), str(today), str(today)),
                synchronous=synchronous,
            )
        last_day = monthrange(today.year, today.month)[1]
        if (
            store_settings.automated_reports_enabled
            and today.day == last_day
            and due(local_now, store_settings.monthly_report_time)
        ):
            period_start = today.replace(day=1)
            dispatched += _dispatch_once(
                store=store_settings.store,
                job_type=ScheduledJobRun.JobType.MONTHLY_REPORT,
                period_key=str(today),
                task=run_report,
                args=(store_settings.store_id, Report.ReportType.MONTHLY, str(period_start), str(today), str(today)),
                synchronous=synchronous,
            )
    return dispatched


@shared_task
def run_debt_sms(store_id, date_string, run_id=None):
    store = Store.objects.get(id=store_id)
    run = _start_scheduled_run(
        store=store,
        job_type=ScheduledJobRun.JobType.DEBT_SMS,
        period_key=date_string,
        run_id=run_id,
    )
    if run is None:
        return "already-run"
    try:
        result = SMSService.send_debt_reminders(store, date.fromisoformat(date_string))
        run.status = ScheduledJobRun.Status.COMPLETED
        run.completed_at = timezone.now()
        run.save(update_fields=["status", "completed_at"])
        return result
    except Exception as exc:
        _mark_failed(run, exc)
        raise


@shared_task
def run_report(store_id, report_type, start_string, end_string, period_key, run_id=None):
    store = Store.objects.get(id=store_id)
    job_type = {
        Report.ReportType.DAILY: ScheduledJobRun.JobType.DAILY_REPORT,
        Report.ReportType.WEEKLY: ScheduledJobRun.JobType.WEEKLY_REPORT,
        Report.ReportType.MONTHLY: ScheduledJobRun.JobType.MONTHLY_REPORT,
    }[report_type]
    run = _start_scheduled_run(store=store, job_type=job_type, period_key=period_key, run_id=run_id)
    if run is None:
        return "already-run"
    try:
        start = date.fromisoformat(start_string)
        end = date.fromisoformat(end_string)
        report = ReportService.generate(store=store, report_type=report_type, period_start=start, period_end=end)
        run.status = ScheduledJobRun.Status.COMPLETED
        run.completed_at = timezone.now()
        run.save(update_fields=["status", "completed_at"])
        return report.id
    except Exception as exc:
        _mark_failed(run, exc)
        raise
