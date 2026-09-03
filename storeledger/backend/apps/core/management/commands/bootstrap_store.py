from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError

from apps.core.models import Membership, Store, StoreSettings


class Command(BaseCommand):
    help = "Create the first store owner and store. Safe to run more than once."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="owner")
        parser.add_argument("--password", default="ChangeMe123!")
        parser.add_argument("--email", default="owner@example.com")
        parser.add_argument("--store-name", default="My Store")

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(
            username=options["username"],
            defaults={"email": options["email"], "is_staff": True},
        )
        if created:
            user.set_password(options["password"])
            user.save()
        store, _ = Store.objects.get_or_create(name=options["store_name"])
        StoreSettings.objects.get_or_create(store=store)
        Membership.objects.update_or_create(
            user=user,
            store=store,
            defaults={"role": Membership.Role.OWNER, "is_active": True},
        )
        self.stdout.write(self.style.SUCCESS(f"Ready: {user.username} owns {store.name}"))
        if created:
            self.stdout.write(self.style.WARNING("Change the initial password after the first login."))

