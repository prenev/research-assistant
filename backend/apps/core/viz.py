"""Pre-shaped data for the visualisations and the progress dashboard. Read-only."""

from collections import Counter, defaultdict
from datetime import timedelta

from django.apps import apps as django_apps
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.journal.models import LogPost
from apps.literature.models import Finding, Paper
from apps.literature.views import FindingFilter, PaperFilter
from apps.project.models import Decision, PipelineStage, ResultEntry, StageStatus
from apps.proteins.models import Protein, ProteinRole
from apps.synthesis.models import Requirement, RequirementAssessment

from .models import BaseModel, SiteSettings

POPULATION_ROWS = ["sporadic_ftd", "genetic_ftd", "mutation_carriers", "general_population"]
DESIGN_COLUMNS = {
    "cross_sectional": ["cross_sectional", "case_control"],
    "longitudinal": ["longitudinal", "progression_model"],
    "prediction": ["prediction", "population_cohort"],
}
TARGET_CELL = {"population": "general_population", "column": "prediction"}
READ_STATES = ("read", "cited")


def live_findings():
    return Finding.objects.filter(
        paper__deleted_at__isnull=True, protein__deleted_at__isnull=True
    ).select_related("paper", "protein")


def paper_brief(p):
    return {
        "id": p.id,
        "slug": p.slug,
        "label": p.short_label or p.title[:40],
        "title": p.title,
        "citation_number": p.citation_number,
        "year": p.year,
    }


def filtered_findings(request):
    return FindingFilter(request.query_params, queryset=live_findings()).qs


class EvidenceMatrixView(APIView):
    """Proteins x papers with the direction of each finding. Only rows/columns with findings
    (unless include_empty=1, to show proteins nobody has reported on yet)."""

    def get(self, request):
        findings = list(filtered_findings(request))
        papers, proteins = {}, {}
        for f in findings:
            papers[f.paper_id] = f.paper
            proteins[f.protein_id] = f.protein
        if request.query_params.get("include_empty") == "1":
            qs = Protein.objects.all()
            for key in ("category", "role"):
                v = request.query_params.get(f"protein_{key}")
                if v:
                    qs = qs.filter(**{key: v})
            for pr in qs:
                proteins.setdefault(pr.id, pr)
        per_protein = defaultdict(list)
        for f in findings:
            per_protein[f.protein_id].append(f)
        rows = []
        for pr in proteins.values():
            fs = per_protein.get(pr.id, [])
            dirs = Counter(f.direction for f in fs)
            top, top_n = dirs.most_common(1)[0] if dirs else (None, 0)
            rows.append(
                {
                    "id": pr.id,
                    "slug": pr.slug,
                    "name": pr.name,
                    "category": pr.category,
                    "role": pr.role,
                    "findings": len(fs),
                    "papers": len({f.paper_id for f in fs}),
                    "top_direction": top,
                    "agreement": round(top_n / len(fs), 2) if fs else None,
                }
            )
        rows.sort(key=lambda r: r["name"].lower())
        cols = [paper_brief(p) for p in papers.values()]
        cols.sort(
            key=lambda c: (c["citation_number"] is None, c["citation_number"] or 0, c["year"] or 0)
        )
        cells = [
            {
                "id": f.id,
                "protein": f.protein_id,
                "paper": f.paper_id,
                "direction": f.direction,
                "context": f.context,
                "context_detail": f.context_detail,
                "effect": f.effect,
                "subgroup": f.subgroup,
                "fluid": f.fluid,
            }
            for f in findings
        ]
        return Response({"proteins": rows, "papers": cols, "cells": cells})


class GapMapView(APIView):
    """Population x study type. Counts papers, or findings for one protein (?protein=slug)."""

    def get(self, request):
        protein = request.query_params.get("protein", "")
        column_of = {d: col for col, ds in DESIGN_COLUMNS.items() for d in ds}
        cells = {
            (r, c): {"papers": {}, "findings": 0} for r in POPULATION_ROWS for c in DESIGN_COLUMNS
        }
        unplaced = {}
        if protein:
            source = [(f.paper, 1) for f in live_findings().filter(protein__slug=protein)]
        else:
            source = [(p, 0) for p in Paper.objects.all()]
        for paper, n in source:
            col = column_of.get(paper.design)
            if paper.population not in POPULATION_ROWS or col is None:
                unplaced[paper.id] = paper
                continue
            cell = cells[(paper.population, col)]
            cell["papers"][paper.id] = paper
            cell["findings"] += n
        out = []
        for (row, col), c in cells.items():
            out.append(
                {
                    "population": row,
                    "column": col,
                    "papers": [paper_brief(p) for p in c["papers"].values()],
                    "count": c["findings"] if protein else len(c["papers"]),
                    "is_target": {"population": row, "column": col} == TARGET_CELL,
                }
            )
        return Response(
            {
                "rows": POPULATION_ROWS,
                "columns": list(DESIGN_COLUMNS),
                "mode": "findings" if protein else "papers",
                "protein": protein,
                "cells": out,
                "unplaced": [paper_brief(p) for p in unplaced.values()],
                "target": TARGET_CELL,
            }
        )


class NetworkView(APIView):
    def get(self, request):
        edges_by_pair = defaultdict(list)
        papers, proteins = {}, {}
        for f in filtered_findings(request):
            edges_by_pair[(f.paper_id, f.protein_id)].append(f.direction)
            papers[f.paper_id] = f.paper
            proteins[f.protein_id] = f.protein
        edges = []
        p_deg, r_deg = Counter(), Counter()
        for (paper_id, protein_id), dirs in edges_by_pair.items():
            direction = dirs[0] if len(set(dirs)) == 1 else "mixed"
            edges.append(
                {
                    "source": f"protein:{proteins[protein_id].slug}",
                    "target": f"paper:{papers[paper_id].slug}",
                    "direction": direction,
                    "count": len(dirs),
                }
            )
            p_deg[paper_id] += 1
            r_deg[protein_id] += 1
        nodes = [
            {"id": f"protein:{p.slug}", "type": "protein", "label": p.name, "slug": p.slug,
             "degree": r_deg[p.id], "role": p.role}
            for p in proteins.values()
        ] + [
            {"id": f"paper:{p.slug}", "type": "paper", "label": p.short_label or p.title[:30],
             "slug": p.slug, "degree": p_deg[p.id], "year": p.year}
            for p in papers.values()
        ]  # fmt: skip
        return Response({"nodes": nodes, "edges": edges})


class TimelineView(APIView):
    def get(self, request):
        papers = PaperFilter(request.query_params, queryset=Paper.objects.all()).qs
        rows, undated = [], []
        for p in papers:
            item = {
                **paper_brief(p),
                "sample_size": p.sample_size,
                "design": p.design,
                "population": p.population,
            }
            (rows if p.year else undated).append(item)
        by_year = Counter(r["year"] for r in rows)
        return Response(
            {
                "papers": rows,
                "undated": undated,
                "per_year": [{"year": y, "count": by_year[y]} for y in sorted(by_year)],
            }
        )


class EvidenceChainView(APIView):
    def get(self, request):
        reqs = list(Requirement.objects.all())
        papers = list(Paper.objects.all())
        by_paper = defaultdict(dict)
        for a in RequirementAssessment.objects.all():
            by_paper[a.paper_id][a.requirement_id] = {
                "id": a.id,
                "met": a.met,
                "justification": a.justification,
            }
        meets_all = [
            paper_brief(p)
            for p in papers
            if reqs and all(by_paper[p.id].get(r.id, {}).get("met") == "yes" for r in reqs)
        ]
        totals = []
        for r in reqs:
            c = Counter(by_paper[p.id].get(r.id, {}).get("met", "unset") for p in papers)
            totals.append({"requirement": r.id, "yes": c["yes"], "partial": c["partial"],
                           "no": c["no"], "unset": c["unset"]})  # fmt: skip
        return Response(
            {
                "requirements": [
                    {"id": r.id, "number": r.number, "title": r.title, "description": r.description}
                    for r in reqs
                ],
                "papers": [{**paper_brief(p), "assessments": by_paper[p.id]} for p in papers],
                "totals": totals,
                "meets_all": meets_all,
                "any_meets_all": bool(meets_all),
            }
        )


# ---------------------------------------------------------------- dashboard
def week_start(day):
    return day - timedelta(days=day.weekday())


def activity_by_day(days=182):
    """Edits per day, from version history (autosaved drafts are not in it)."""
    start = timezone.localdate() - timedelta(days=days - 1)
    counts = Counter()
    for model in django_apps.get_models():
        if issubclass(model, BaseModel) and not model._meta.abstract:
            for dt in model.history.filter(history_date__date__gte=start).values_list(
                "history_date", flat=True
            ):
                counts[timezone.localtime(dt).date()] += 1
    return counts


def streaks(counts, today):
    def run_ending(day):
        n = 0
        while counts.get(day, 0) > 0:
            n += 1
            day -= timedelta(days=1)
        return n

    current = run_ending(today)
    at_risk = False
    if current == 0:  # today is not over: yesterday still counts
        current = run_ending(today - timedelta(days=1))
        at_risk = current > 0
    longest = best = 0
    for day in sorted(counts):
        best = best + 1 if counts.get(day - timedelta(days=1), 0) > 0 else 1
        longest = max(longest, best)
    return current, longest, at_risk


def papers_finished_this_week(monday):
    HP = Paper.history.model
    finished = set()
    for rec in HP.objects.filter(history_date__date__gte=monday, deleted_at__isnull=True):
        if rec.reading_status in READ_STATES:
            prev = rec.prev_record
            if prev is None or prev.reading_status not in READ_STATES:
                finished.add(rec.id)
    live = set(Paper.objects.filter(id__in=finished).values_list("id", flat=True))
    return len(live)


def next_actions():
    actions = []
    papers = list(Paper.objects.all())
    finding_papers = set(Finding.objects.values_list("paper_id", flat=True))
    if not papers:
        actions.append(
            {"kind": "papers", "title": "Add your first papers",
             "detail": "Paste a DOI or import a BibTeX / Zotero file to start your reading list.",
             "url": "/papers"}
        )  # fmt: skip
    core_unread = [p for p in papers if p.relevance == "core" and p.reading_status == "to_read"]
    if core_unread:
        actions.append(
            {"kind": "reading", "title": f"{len(core_unread)} core paper{'s' if len(core_unread) != 1 else ''} still to read",
             "detail": ", ".join(p.short_label or p.title[:30] for p in core_unread[:3]),
             "url": "/papers?relevance=core&reading_status=to_read"}
        )  # fmt: skip
    read_no_findings = [
        p for p in papers if p.reading_status in READ_STATES and p.id not in finding_papers
    ]
    if read_no_findings:
        actions.append(
            {"kind": "findings", "title": f"{len(read_no_findings)} paper{'s' if len(read_no_findings) != 1 else ''} you've read have no findings recorded",
             "detail": "Record what each one says about each protein so it shows up in the Evidence Matrix.",
             "url": "/papers?reading_status=read"}
        )  # fmt: skip
    proteins = list(Protein.objects.exclude(role=ProteinRole.EXCLUDED))
    with_findings = set(Finding.objects.values_list("protein_id", flat=True))
    no_evidence = [p for p in proteins if p.id not in with_findings]
    if no_evidence and papers:
        actions.append(
            {"kind": "evidence", "title": f"{len(no_evidence)} protein{'s have' if len(no_evidence) != 1 else ' has'} no evidence yet",
             "detail": ", ".join(p.name for p in no_evidence[:4]) + ("…" if len(no_evidence) > 4 else ""),
             "url": "/visualise/evidence-matrix?include_empty=1"}
        )  # fmt: skip
    no_rationale = [
        p for p in proteins if p.role == ProteinRole.CANDIDATE and not p.rationale.strip()
    ]
    if no_rationale:
        actions.append(
            {"kind": "rationale", "title": f"Write the rationale for {len(no_rationale)} candidate protein{'s' if len(no_rationale) != 1 else ''}",
             "detail": "Why is each one a candidate? A line or two is enough to start.",
             "url": "/proteins"}
        )  # fmt: skip
    in_target = [
        p for p in papers
        if p.population == TARGET_CELL["population"] and p.design in DESIGN_COLUMNS[TARGET_CELL["column"]]
    ]  # fmt: skip
    if papers and not in_target:
        actions.append(
            {"kind": "gap", "title": "Nothing yet for incident FTD in the general population",
             "detail": "That is the gap this project fills. Look for population-cohort or prediction studies.",
             "url": "/visualise/gap-map"}
        )  # fmt: skip
    stages = list(PipelineStage.objects.all())
    current = next((s for s in stages if s.status == StageStatus.IN_PROGRESS), None)
    upcoming = next((s for s in stages if s.status == StageStatus.NOT_STARTED), None)
    if current:
        actions.append({"kind": "pipeline", "title": f"Continue: {current.title}",
                        "detail": "This step is marked in progress.", "url": "/pipeline"})  # fmt: skip
    elif upcoming:
        actions.append({"kind": "pipeline", "title": f"Next step: {upcoming.title}",
                        "detail": "Nothing is in progress. Start the next pipeline step.", "url": "/pipeline"})  # fmt: skip
    week_ago = timezone.localdate() - timedelta(days=7)
    if not LogPost.objects.filter(date__gte=week_ago).exists():
        actions.append(
            {"kind": "log", "title": "Write a short log entry",
             "detail": "Nothing in the log for a week. Two lines on what you learned will do.",
             "url": "/log"}
        )  # fmt: skip
    incomplete = [
        p
        for p in papers
        if p.reading_status in READ_STATES and not (p.condition_studied and p.dataset)
    ]
    if incomplete:
        actions.append(
            {"kind": "details", "title": f"Fill in study details for {len(incomplete)} read paper{'s' if len(incomplete) != 1 else ''}",
             "detail": "Condition, cohort and NfL involvement make the papers filterable.",
             "url": "/papers?reading_status=read"}
        )  # fmt: skip
    return actions[:6]


def milestones():
    papers = list(Paper.objects.all())
    n_read = sum(1 for p in papers if p.reading_status in READ_STATES)
    candidates = list(Protein.objects.filter(role=ProteinRole.CANDIDATE))
    with_rationale = sum(1 for p in candidates if p.rationale.strip())
    stages = list(PipelineStage.objects.all())
    done = sum(1 for s in stages if s.status == StageStatus.DONE)
    in_target = any(
        p.population == TARGET_CELL["population"]
        and p.design in DESIGN_COLUMNS[TARGET_CELL["column"]]
        for p in papers
    )
    items = [
        ("papers10", "Add 10 papers", len(papers), 10),
        ("read5", "Finish reading 5 papers", n_read, 5),
        ("findings10", "Record 10 findings", Finding.objects.count(), 10),
        ("rationales", "Write a rationale for every candidate protein", with_rationale, max(len(candidates), 1)),
        ("log2", "Write a log entry of your own", max(LogPost.objects.count() - 1, 0), 1),
        ("gap", "Find a paper in the target cell of the gap map", int(in_target), 1),
        ("decisions", "Record a decision of your own", max(Decision.objects.count() - 5, 0), 1),
        ("result", "Enter your first result", ResultEntry.objects.count(), 1),
        ("half", "Finish half of the pipeline", done, max((len(stages) + 1) // 2, 1)),
    ]  # fmt: skip
    return [
        {"key": k, "label": label, "current": min(cur, tgt), "target": tgt, "done": cur >= tgt}
        for k, label, cur, tgt in items
    ]


class DashboardView(APIView):
    def get(self, request):
        today = timezone.localdate()
        counts = activity_by_day()
        current, longest, at_risk = streaks(counts, today)
        goal = SiteSettings.load().weekly_reading_goal
        papers = list(Paper.objects.all())
        status_counts = Counter(p.reading_status for p in papers)
        proteins = Protein.objects.count()
        with_findings = (
            Finding.objects.filter(protein__deleted_at__isnull=True)
            .values("protein")
            .distinct()
            .count()
        )
        return Response(
            {
                "today": today,
                "activity": [{"date": d, "count": c} for d, c in sorted(counts.items())],
                "streak": {"current": current, "longest": longest, "at_risk": at_risk},
                "week": {
                    "start": week_start(today),
                    "goal": goal,
                    "finished": papers_finished_this_week(week_start(today)),
                    "edits": sum(c for d, c in counts.items() if d >= week_start(today)),
                },
                "reading": {
                    "to_read": status_counts["to_read"],
                    "reading": status_counts["reading"],
                    "read": status_counts["read"] + status_counts["cited"],
                    "total": len(papers),
                },
                "evidence": {
                    "findings": Finding.objects.count(),
                    "proteins": proteins,
                    "proteins_with_findings": with_findings,
                },  # fmt: skip
                "next_actions": next_actions(),
                "milestones": milestones(),
            }
        )
