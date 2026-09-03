from calendar import monthrange
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from celery import shared_task
from django.db import IntegrityError
from django.utils import timezone

from .models import Report, ScheduledJobRun, Store, StoreSettings
from .services import ReportService, SMSService


def due(local_now, scheduled_time):
    return (local_now.hour, local_now.minute) >= (scheduled_time.hour, scheduled_time.minute)


@shared_task
def dispatch_scheduled_jobs(synchronous=False):
    """Dispatch due jobs. Synchronous mode supports local acceptance testing without Redis."""
    dispatched = 0

    def send_sms(store_id, period_key):
        if synchronous:
            return run_debt_sms(store_id, period_key)
        return run_debt_sms.delay(store_id, period_key)

    def send_report(store_id, report_type, start_string, end_string, period_key):
        if synchronous:
            return run_report(store_id, report_type, start_string, end_string, period_key)
        return run_report.delay(store_id, report_type, start_string, end_string, period_key)

    for store_settings in StoreSettings.objects.select_related("store").filter(store__is_active=True):
        local_now = timezone.now().astimezone(ZoneInfo(store_settings.store.timezone))
        today = local_now.date()
        if store_settings.sms_enabled and due(local_now, store_settings.sms_reminder_time):
            send_sms(store_settings.store_id, str(today))
            dispatched += 1
        if store_settings.automated_reports_enabled and due(local_now, store_settings.daily_report_time):
            send_report(store_settings.store_id, Report.ReportType.DAILY, str(today), str(today), str(today))
            dispatched += 1
        if (
            store_settings.automated_reports_enabled
            and local_now.weekday() == store_settings.weekly_report_day
            and due(local_now, store_settings.weekly_report_time)
        ):
            period_start = today - timedelta(days=6)
            send_report(store_settings.store_id, Report.ReportType.WEEKLY, str(period_start), str(today), str(today))
            dispatched += 1
        last_day = monthrange(today.year, today.month)[1]
        if (
            store_settings.automated_reports_enabled
            and today.day == last_day
            and due(local_now, store_settings.monthly_report_time)
        ):
            period_start = today.replace(day=1)
            send_report(store_settings.store_id, Report.ReportType.MONTHLY, str(period_start), str(today), str(today))
            dispatched += 1
    return dispatched


@shared_task
def run_debt_sms(store_id, date_string):
    store = Store.objects.get(id=store_id)
    try:
        run = ScheduledJobRun.objects.create(
            store=store,
            job_type=ScheduledJobRun.JobType.DEBT_SMS,
            period_key=date_string,
        )
    except IntegrityError:
        return "already-run"
    try:
        result = SMSService.send_debt_reminders(store, date.fromisoformat(date_string))
        run.status = ScheduledJobRun.Status.COMPLETED
        run.completed_at = timezone.now()
        run.save(update_fields=["status", "completed_at"])
        return result
    except Exception as exc:
        run.status = ScheduledJobRun.Status.FAILED
        run.error_message = str(exc)
        run.completed_at = timezone.now()
        run.save(update_fields=["status", "error_message", "completed_at"])
        raise


@shared_task
def run_report(store_id, report_type, start_string, end_string, period_key):
    store = Store.objects.get(id=store_id)
    job_type = {
        Report.ReportType.DAILY: ScheduledJobRun.JobType.DAILY_REPORT,
        Report.ReportType.WEEKLY: ScheduledJobRun.JobType.WEEKLY_REPORT,
        Report.ReportType.MONTHLY: ScheduledJobRun.JobType.MONTHLY_REPORT,
    }[report_type]
    try:
        run = ScheduledJobRun.objects.create(store=store, job_type=job_type, period_key=period_key)
    except IntegrityError:
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
        run.status = ScheduledJobRun.Status.FAILED
        run.error_message = str(exc)
        run.completed_at = timezone.now()
        run.save(update_fields=["status", "error_message", "completed_at"])
        raise
