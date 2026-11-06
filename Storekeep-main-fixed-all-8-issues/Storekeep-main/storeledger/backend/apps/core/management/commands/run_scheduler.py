import time

from django.core.management.base import BaseCommand

from apps.core.tasks import dispatch_scheduled_jobs


class Command(BaseCommand):
    help = "Run StoreLedger scheduled SMS and report jobs locally without Redis/Celery."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true", help="Check and run due jobs once, then exit.")
        parser.add_argument("--interval", type=int, default=60, help="Seconds between checks (default: 60).")

    def handle(self, *args, **options):
        interval = max(options["interval"], 10)
        self.stdout.write(self.style.SUCCESS("StoreLedger local scheduler started."))
        while True:
            dispatched = dispatch_scheduled_jobs(synchronous=True)
            self.stdout.write(f"Checked schedules; dispatched {dispatched} due job(s).")
            if options["once"]:
                return
            try:
                time.sleep(interval)
            except KeyboardInterrupt:
                self.stdout.write(self.style.WARNING("Scheduler stopped."))
                return
