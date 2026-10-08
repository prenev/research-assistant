import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403

DEBUG = False
if SECRET_KEY.startswith("dev-insecure"):  # noqa: F405
    raise ImproperlyConfigured("Set SECRET_KEY in the environment for production.")

SECURE_SSL_REDIRECT = os.environ.get("SECURE_SSL_REDIRECT", "1") == "1"
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_CONTENT_TYPE_NOSNIFF = True

# ---- single-service hosting (e.g. Render): Django serves the API, React app and media ----
_render_host = os.environ.get("RENDER_EXTERNAL_HOSTNAME")
if _render_host:
    ALLOWED_HOSTS = [*ALLOWED_HOSTS, _render_host]  # noqa: F405
_render_url = os.environ.get("RENDER_EXTERNAL_URL")
if _render_url:
    CSRF_TRUSTED_ORIGINS = [*CSRF_TRUSTED_ORIGINS, _render_url]  # noqa: F405

MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")  # noqa: F405
FRONTEND_DIST = BASE_DIR / "frontend_dist"  # noqa: F405  (filled by build.sh)
if FRONTEND_DIST.is_dir():
    WHITENOISE_ROOT = FRONTEND_DIST
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
SECURE_REDIRECT_EXEMPT = [r"^healthz$"]
