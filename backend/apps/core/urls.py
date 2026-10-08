from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.docs.views import DocCategoryViewSet, DocPageViewSet
from apps.journal.views import LogPostViewSet
from apps.literature.views import (
    FindingViewSet,
    ImportConfirmView,
    ImportPreviewView,
    PaperViewSet,
    TagViewSet,
)
from apps.project.views import DecisionViewSet, PipelineStageViewSet, ResultEntryViewSet
from apps.proteins.views import ProteinViewSet
from apps.synthesis.views import RequirementAssessmentViewSet, RequirementViewSet

from . import tools, views

router = DefaultRouter()
router.register("papers", PaperViewSet, basename="paper")
router.register("proteins", ProteinViewSet, basename="protein")
router.register("findings", FindingViewSet, basename="finding")
router.register("tags", TagViewSet, basename="tag")
router.register("doc-categories", DocCategoryViewSet, basename="doccategory")
router.register("doc-pages", DocPageViewSet, basename="docpage")
router.register("log-posts", LogPostViewSet, basename="logpost")
router.register("pipeline-stages", PipelineStageViewSet, basename="pipelinestage")
router.register("decisions", DecisionViewSet, basename="decision")
router.register("results", ResultEntryViewSet, basename="resultentry")
router.register("requirements", RequirementViewSet, basename="requirement")
router.register(
    "requirement-assessments", RequirementAssessmentViewSet, basename="requirementassessment"
)

urlpatterns = [
    path("auth/csrf/", views.CsrfView.as_view()),
    path("auth/login/", views.LoginView.as_view()),
    path("auth/logout/", views.LogoutView.as_view()),
    path("me/", views.MeView.as_view()),
    path("settings/", views.SettingsView.as_view()),
    path("stats/", views.StatsView.as_view()),
    path("sidebar/", views.SidebarView.as_view()),
    path("sidebar/reorder/", views.SidebarReorderView.as_view()),
    path("search-index/", views.SearchIndexView.as_view()),
    path("form-meta/<str:prefix>/", views.FormMetaView.as_view()),
    path("trash/", tools.TrashView.as_view()),
    path("uploads/", tools.UploadView.as_view()),
    path("export/json/", tools.ExportJsonView.as_view()),
    path("export/bibtex/", tools.ExportBibtexView.as_view()),
    path("export/ieee/", tools.ExportIeeeView.as_view()),
    path("import/bibtex/", ImportPreviewView.as_view(kind="bibtex")),
    path("import/zotero-csv/", ImportPreviewView.as_view(kind="zotero")),
    path("import/bibtex/confirm/", ImportConfirmView.as_view()),
    path("import/zotero-csv/confirm/", ImportConfirmView.as_view()),
    path("", include(router.urls)),
]
