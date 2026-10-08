from django.conf import settings
from django.http import Http404, HttpResponse


def healthz(request):
    return HttpResponse("ok", content_type="text/plain")


def spa(request, *args, **kwargs):
    """Serve the built React app's index.html for any non-API path (client-side routing)."""
    index = getattr(settings, "FRONTEND_DIST", settings.BASE_DIR / "frontend_dist") / "index.html"
    if not index.is_file():
        raise Http404("Frontend not built. Run build.sh (or `npm run build` in frontend/).")
    return HttpResponse(index.read_text(encoding="utf-8"), content_type="text/html; charset=utf-8")
