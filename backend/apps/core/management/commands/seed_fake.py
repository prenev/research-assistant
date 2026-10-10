"""Generate a large block of FAKE papers, proteins and findings to test the charts at scale.

Everything is marked: titles start with "[FAKE]", proteins are named "FAKE-P<n>", each paper has the
`fake-data` tag, and findings say FAKE in their notes. `seed` never runs this. Remove it all with
`purge_fake`. Bulk inserts bypass version history, so it does not touch your activity streak.
"""

import random

from django.core.management.base import BaseCommand, CommandError

from apps.literature.models import (
    ConditionStudied,
    Design,
    Direction,
    Finding,
    FindingContext,
    Fluid,
    NflInvolved,
    Paper,
    Platform,
    Population,
    ReadingStatus,
    Relevance,
    ReviewSection,
    Tag,
)
from apps.proteins.models import Protein, ProteinCategory, ProteinRole

FAKE_TAG = "fake-data"


class Command(BaseCommand):
    help = "Create clearly-marked FAKE data for testing at scale (needs --yes)."

    def add_arguments(self, parser):
        parser.add_argument("--papers", type=int, default=300)
        parser.add_argument("--proteins", type=int, default=200)
        parser.add_argument("--findings", type=int, default=2000)
        parser.add_argument("--rng", type=int, default=1, help="Random seed, for repeatable data.")
        parser.add_argument("--yes", action="store_true", help="Confirm you want fake data added.")

    def handle(self, *args, papers, proteins, findings, rng, yes, **opts):
        if not yes:
            raise CommandError("This adds FAKE data. Run again with --yes to confirm.")
        if Paper.all_objects.filter(slug__startswith="fake-paper-").exists():
            raise CommandError("Fake data already exists. Run `purge_fake` first.")
        r = random.Random(rng)
        pick = lambda choices: r.choice(choices.values)  # noqa: E731
        tag, _ = Tag.objects.get_or_create(
            slug=FAKE_TAG, defaults={"name": FAKE_TAG, "colour": "#d03b3b"}
        )

        paper_objs = [
            Paper(
                title=f"[FAKE] Synthetic study number {i}",
                slug=f"fake-paper-{i}",
                first_author_surname=f"Fake{i}",
                authors=f"F. Fake{i} et al.",
                year=r.randint(2005, 2026),
                journal="Journal of Made-Up Results",
                design=pick(Design),
                population=pick(Population),
                sample_size=int(10 ** r.uniform(1.3, 5.2)),
                fluids=r.sample(Fluid.values, r.randint(1, 2)),
                platform=pick(Platform),
                review_section=pick(ReviewSection),
                reading_status=pick(ReadingStatus),
                relevance=r.choice([*Relevance.values, ""]),
                condition_studied=pick(ConditionStudied),
                nfl_involved=pick(NflInvolved),
                dataset="FAKE cohort",
                key_finding="FAKE: synthetic data for testing only.",
                notes="FAKE TEST DATA. Safe to delete.",
            )
            for i in range(1, papers + 1)
        ]
        Paper.objects.bulk_create(paper_objs, batch_size=500)
        paper_ids = list(
            Paper.all_objects.filter(slug__startswith="fake-paper-").values_list("id", flat=True)
        )
        Paper.tags.through.objects.bulk_create(
            [Paper.tags.through(paper_id=pid, tag_id=tag.id) for pid in paper_ids], batch_size=500
        )

        protein_objs = [
            Protein(
                name=f"FAKE-P{i}",
                slug=f"fake-p{i}",
                category=pick(ProteinCategory),
                role=pick(ProteinRole),
                rationale="FAKE TEST DATA." if i % 3 else "",
            )
            for i in range(1, proteins + 1)
        ]
        Protein.objects.bulk_create(protein_objs, batch_size=500)
        protein_ids = list(
            Protein.all_objects.filter(slug__startswith="fake-p").values_list("id", flat=True)
        )

        # Each protein leans one way, so the matrix shows some real-looking agreement.
        lean = {
            pid: r.choice([Direction.RAISED, Direction.LOWERED, Direction.NO_DIFFERENCE])
            for pid in protein_ids
        }
        finding_objs = []
        for _ in range(findings):
            pid = r.choice(protein_ids)
            direction = lean[pid] if r.random() < 0.65 else pick(Direction)
            finding_objs.append(
                Finding(
                    paper_id=r.choice(paper_ids),
                    protein_id=pid,
                    direction=direction,
                    context=pick(FindingContext),
                    context_detail="FAKE",
                    effect="" if r.random() < 0.6 else f"AUC {r.uniform(0.55, 0.9):.2f}",
                    fluid=r.choice(Fluid.values),
                    notes="FAKE",
                )
            )
        Finding.objects.bulk_create(finding_objs, batch_size=500)
        self.stdout.write(
            self.style.SUCCESS(
                f"Created FAKE data: {papers} papers, {proteins} proteins, {findings} findings. "
                "Remove with: manage.py purge_fake"
            )
        )
