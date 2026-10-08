from django.db import transaction
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response


class NotebookViewSet(viewsets.ModelViewSet):
    """CRUD + soft delete + version history/restore for any BaseModel."""

    draft_only_fields = {"draft_body"}

    def save_kwargs(self):
        return {}

    def perform_create(self, serializer):
        serializer.save(**self.save_kwargs())

    def perform_update(self, serializer):
        # Autosaves touch only the draft; keep them out of version history.
        if set(self.request.data.keys()) <= self.draft_only_fields:
            serializer.instance.skip_history_when_saving = True
        serializer.save(**self.save_kwargs())

    def perform_destroy(self, instance):
        instance.delete()  # soft delete

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        obj = self.get_object()
        records = list(obj.history.all().order_by("-history_date", "-history_id"))
        out = []
        for i, rec in enumerate(records):
            prev = records[i + 1] if i + 1 < len(records) else None
            changes = []
            if prev is not None:
                delta = rec.diff_against(prev)
                changes = [
                    {"field": c.field, "old": _plain(c.old), "new": _plain(c.new)}
                    for c in delta.changes
                ]
            out.append(
                {
                    "history_id": rec.history_id,
                    "history_date": rec.history_date,
                    "history_type": rec.history_type,
                    "user": rec.history_user.get_username() if rec.history_user else None,
                    "changes": changes,
                }
            )
        return Response(out)

    @action(detail=True, methods=["post"], url_path=r"restore/(?P<history_id>\d+)")
    def restore(self, request, pk=None, history_id=None):
        obj = self.get_object()
        try:
            rec = obj.history.get(history_id=history_id)
        except obj.history.model.DoesNotExist as exc:
            raise NotFound("No such version.") from exc
        with transaction.atomic():
            restored = rec.instance
            restored.deleted_at = None
            restored.save()
        return Response(self.get_serializer(restored).data)


def _plain(value):
    return (
        value if isinstance(value, (str, int, float, bool, list, dict, type(None))) else str(value)
    )
