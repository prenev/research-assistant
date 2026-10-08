from django.contrib.auth import authenticate, login, logout
from django.db import transaction
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.docs.models import DocCategory, DocPage
from apps.journal.models import LogPost
from apps.literature.models import Paper
from apps.project.models import Decision, PipelineStage, StageStatus
from apps.proteins.models import Protein

from .models import SiteSettings
from .serializers import SiteSettingsSerializer


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []  # login itself needs no session/CSRF check
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        user = authenticate(
            request,
            username=request.data.get("username", ""),
            password=request.data.get("password", ""),
        )
        if user is None:
            return Response({"detail": "Invalid credentials."}, status=status.HTTP_400_BAD_REQUEST)
        login(request, user)
        return Response({"username": user.get_username(), "id": user.pk})


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        u = request.user
        if not u.is_authenticated:
            return Response(
                {"authenticated": False, "public_read": SiteSettings.load().public_read}
            )
        return Response({"authenticated": True, "username": u.get_username(), "id": u.pk})


class SettingsView(APIView):
    permission_classes = [AllowAny]  # public GET: the shell needs branding before login

    def get(self, request):
        data = SiteSettingsSerializer(SiteSettings.load(), context={"request": request}).data
        return Response(data)

    def put(self, request):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_403_FORBIDDEN)
        ser = SiteSettingsSerializer(
            SiteSettings.load(), data=request.data, partial=True, context={"request": request}
        )
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    patch = put


class StatsView(APIView):
    def get(self, request):
        stages = PipelineStage.objects.count()
        done = PipelineStage.objects.filter(status=StageStatus.DONE).count()
        recent = []
        for model, kind, url in (
            (DocPage, "doc", "/docs/{slug}"),
            (Paper, "paper", "/papers/{slug}"),
            (Protein, "protein", "/proteins/{slug}"),
            (LogPost, "log", "/log/{slug}"),
        ):
            for o in model.objects.order_by("-updated_at")[:5]:
                recent.append(
                    {
                        "type": kind,
                        "title": str(o) if kind != "paper" else o.title,
                        "url": url.format(slug=o.slug),
                        "updated_at": o.updated_at,
                    }
                )
        recent.sort(key=lambda r: r["updated_at"], reverse=True)
        return Response(
            {
                "papers": Paper.objects.count(),
                "proteins": Protein.objects.count(),
                "pipeline_stages": stages,
                "pipeline_done": done,
                "pipeline_progress_pct": round(100 * done / stages) if stages else 0,
                "recently_edited": recent[:8],
            }
        )


def _category_node(cat, children_by_parent, pages_by_cat):
    items = []
    for p in pages_by_cat.get(cat.pk, []):
        items.append(
            {
                "type": "page",
                "id": p.pk,
                "slug": p.slug,
                "title": p.sidebar_label or p.title,
                "position": p.position,
            }
        )
    for c in children_by_parent.get(cat.pk, []):
        items.append(_category_node(c, children_by_parent, pages_by_cat))
    items.sort(key=lambda i: (i["position"], i["title"]))
    return {
        "type": "category",
        "id": cat.pk,
        "slug": cat.slug,
        "title": cat.title,
        "description": cat.description,
        "position": cat.position,
        "collapsed": cat.collapsed_by_default,
        "items": items,
    }


class SidebarView(APIView):
    def get(self, request):
        cats = list(DocCategory.objects.all())
        pages_by_cat: dict = {}
        for p in DocPage.objects.filter(category__in=cats):
            pages_by_cat.setdefault(p.category_id, []).append(p)
        children: dict = {}
        for c in cats:
            children.setdefault(c.parent_id, []).append(c)
        tree = [_category_node(c, children, pages_by_cat) for c in children.get(None, [])]
        return Response(tree)


class SidebarReorderView(APIView):
    """POST {"items": [{"type": "page"|"category", "id", "parent", "position"}]}"""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        items = request.data.get("items")
        if not isinstance(items, list):
            return Response({"items": "Expected a list."}, status=status.HTTP_400_BAD_REQUEST)
        cat_ids = set(DocCategory.objects.values_list("pk", flat=True))
        for it in items:
            if it.get("type") not in ("page", "category") or not isinstance(
                it.get("position"), int
            ):
                return Response({"detail": f"Bad item: {it}"}, status=status.HTTP_400_BAD_REQUEST)
            parent = it.get("parent")
            if parent is not None and parent not in cat_ids:
                return Response(
                    {"detail": f"Unknown parent: {parent}"}, status=status.HTTP_400_BAD_REQUEST
                )
            if it["type"] == "page" and parent is None:
                return Response(
                    {"detail": "A page needs a parent category."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if it["type"] == "category" and parent == it.get("id"):
                return Response(
                    {"detail": "Category cannot be its own parent."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        # Reject cycles: apply the proposed parents on top of the current tree and walk up.
        parents = dict(DocCategory.objects.values_list("pk", "parent_id"))
        for it in items:
            if it["type"] == "category":
                parents[it["id"]] = it.get("parent")
        for cid in parents:
            seen, node = set(), cid
            while node is not None:
                if node in seen:
                    return Response(
                        {"detail": "A category cannot be moved inside itself."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                seen.add(node)
                node = parents.get(node)
        with transaction.atomic():
            for it in items:
                if it["type"] == "page":
                    obj = DocPage.objects.get(pk=it["id"])
                    obj.category_id = it["parent"]
                else:
                    obj = DocCategory.objects.get(pk=it["id"])
                    obj.parent_id = it.get("parent")
                obj.position = it["position"]
                obj.save()
        return SidebarView().get(request)


class SearchIndexView(APIView):
    """Compact index for client-side Fuse.js search. Text is truncated to keep it light."""

    def get(self, request):
        out = []
        for p in DocPage.objects.select_related("category"):
            out.append(
                {
                    "type": "docs",
                    "title": p.title,
                    "url": f"/docs/{p.slug}",
                    "context": p.category.title,
                    "text": (p.description + " " + p.body)[:2000],
                }
            )
        for p in Paper.objects.all():
            out.append(
                {
                    "type": "papers",
                    "title": p.title,
                    "url": f"/papers/{p.slug}",
                    "context": p.short_label,
                    "text": f"{p.authors} {p.key_finding} {p.doi or ''}"[:1000],
                }
            )
        for p in Protein.objects.all():
            out.append(
                {
                    "type": "proteins",
                    "title": p.name,
                    "url": f"/proteins/{p.slug}",
                    "context": p.get_category_display(),
                    "text": f"{' '.join(p.aliases)} {p.olink_assay_name} {p.rationale}"[:1000],
                }
            )
        for p in LogPost.objects.all():
            out.append(
                {
                    "type": "log",
                    "title": p.title,
                    "url": f"/log/{p.slug}",
                    "context": str(p.date),
                    "text": p.body[:2000],
                }
            )
        for d in Decision.objects.all():
            out.append(
                {
                    "type": "decisions",
                    "title": d.title,
                    "url": f"/decisions#{d.slug}",
                    "context": d.get_status_display(),
                    "text": f"{d.decision} {d.rationale}"[:1000],
                }
            )
        return Response(out)


class FormMetaView(APIView):
    """Field metadata (types, choices, required) for a model's create form.

    Same data DRF serves for OPTIONS, as a plain GET (some dev proxies answer OPTIONS themselves).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, prefix):
        from django.http import Http404
        from rest_framework.metadata import SimpleMetadata

        from .urls import router

        viewset = next((v for p, v, _ in router.registry if p == prefix), None)
        if viewset is None:
            raise Http404
        view = viewset()
        view.request, view.args, view.kwargs, view.format_kwarg = request, (), {}, None
        view.action = "create"
        view.action_map = {"post": "create"}
        view.post = view.create  # lets DRF see POST as an allowed method
        meta = SimpleMetadata().determine_metadata(request, view)
        return Response({"fields": meta.get("actions", {}).get("POST", {})})
