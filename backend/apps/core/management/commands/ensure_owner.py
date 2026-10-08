"""Create the single login from environment variables, so no shell access is needed."""

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create the owner account from OWNER_USERNAME / OWNER_PASSWORD (idempotent)."

    def handle(self, *args, **opts):
        username = os.environ.get("OWNER_USERNAME", "").strip()
        password = os.environ.get("OWNER_PASSWORD", "")
        if not username or not password:
            self.stdout.write("OWNER_USERNAME / OWNER_PASSWORD not set; skipping.")
            return
        User = get_user_model()
        user, created = User.objects.get_or_create(
            username=username, defaults={"is_staff": True, "is_superuser": True}
        )
        # Only set the password on creation, or when explicitly asked, so a password changed
        # later in the admin is not overwritten on every deploy.
        if created or os.environ.get("OWNER_RESET_PASSWORD") == "1":
            user.set_password(password)
            user.is_staff = user.is_superuser = True
            user.save()
        self.stdout.write(f"Owner '{username}' {'created' if created else 'already exists'}.")
