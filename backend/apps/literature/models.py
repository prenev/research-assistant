from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import BaseModel, unique_slug


class Design(models.TextChoices):
    SYSTEMATIC_REVIEW = "systematic_review", "Systematic review"
    META_ANALYSIS = "meta_analysis", "Meta-analysis"
    CROSS_SECTIONAL = "cross_sectional", "Cross-sectional"
    CASE_CONTROL = "case_control", "Case-control"
    LONGITUDINAL = "longitudinal", "Longitudinal"
    PREDICTION = "prediction", "Prediction"
    POPULATION_COHORT = "population_cohort", "Population cohort"
    PROGRESSION_MODEL = "progression_model", "Progression model"
    OTHER = "other", "Other"


class Population(models.TextChoices):
    SPORADIC_FTD = "sporadic_ftd", "Sporadic FTD"
    GENETIC_FTD = "genetic_ftd", "Genetic FTD"
    MUTATION_CARRIERS = "mutation_carriers", "Mutation carriers"
    GENERAL_POPULATION = "general_population", "General population"
    MIXED_NEURODEGENERATIVE = "mixed_neurodegenerative", "Mixed neurodegenerative"
    OTHER = "other", "Other"


class Fluid(models.TextChoices):
    PLASMA = "plasma", "Plasma"
    SERUM = "serum", "Serum"
    CSF = "csf", "CSF"
    BRAIN_TISSUE = "brain_tissue", "Brain tissue"
    PET_IMAGING = "pet_imaging", "PET imaging"


class Platform(models.TextChoices):
    OLINK = "olink", "Olink"
    SOMASCAN = "somascan", "SomaScan"
    SIMOA = "simoa", "Simoa"
    LUMINEX = "luminex", "Luminex"
    MSD = "msd", "MSD"
    ELISA = "elisa", "ELISA"
    NULISA = "nulisa", "NULISA"
    OTHER = "other", "Other"
    MIXED = "mixed", "Mixed"


class ReviewSection(models.TextChoices):
    INTRO = "intro", "Introduction"
    PERIPHERAL_INFLAMMATION = "peripheral_inflammation", "Peripheral inflammation in FTD"
    PRESYMPTOMATIC = "presymptomatic", "Before symptom onset"
    ADDED_VALUE = "added_value", "Added value beyond blood markers"
    POPULATION_METHODS = "population_methods", "Population and methods"
    SYNTHESIS = "synthesis", "Synthesis and gap"


class ReadingStatus(models.TextChoices):
    TO_READ = "to_read", "To read"
    READING = "reading", "Reading"
    READ = "read", "Read"
    CITED = "cited", "Cited"


class Direction(models.TextChoices):
    RAISED = "raised", "Raised"
    LOWERED = "lowered", "Lowered"
    NO_DIFFERENCE = "no_difference", "No difference"
    ASSOCIATED = "associated", "Associated"
    NOT_ASSOCIATED = "not_associated", "Not associated"
    PREDICTIVE = "predictive", "Predictive"
    NOT_PREDICTIVE = "not_predictive", "Not predictive"
    MIXED = "mixed", "Mixed"


class FindingContext(models.TextChoices):
    SYMPTOMATIC_VS_CONTROLS = "symptomatic_vs_controls", "Symptomatic vs controls"
    FTD_VS_OTHER = "ftd_vs_other_disease", "FTD vs other disease"
    PRESYMPTOMATIC_VS_NONCARRIERS = (
        "presymptomatic_vs_noncarriers",
        "Presymptomatic vs non-carriers",
    )
    CONVERSION_PREDICTION = "conversion_prediction", "Conversion prediction"
    PROGRESSION_OR_SURVIVAL = "progression_or_survival", "Progression or survival"
    INCIDENT_DEMENTIA_POPULATION = "incident_dementia_population", "Incident dementia (population)"
    BRAIN_CORRESPONDENCE = "brain_correspondence", "Brain correspondence"
    OTHER = "other", "Other"


def validate_fluids(value):
    valid = set(Fluid.values)
    if not isinstance(value, list) or any(v not in valid for v in value):
        raise ValidationError(f"Each fluid must be one of: {', '.join(sorted(valid))}.")


class Tag(BaseModel):
    name = models.CharField(max_length=60)
    slug = models.SlugField(max_length=80, unique=True, blank=True)
    colour = models.CharField(max_length=7, blank=True)

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.name, 80)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Paper(BaseModel):
    citation_number = models.PositiveIntegerField(null=True, blank=True, unique=True)
    slug = models.SlugField(max_length=200, unique=True, blank=True)
    title = models.TextField()
    authors = models.TextField(blank=True)
    first_author_surname = models.CharField(max_length=80, blank=True)
    year = models.PositiveIntegerField(null=True, blank=True)
    journal = models.CharField(max_length=200, blank=True)
    volume = models.CharField(max_length=30, blank=True)
    issue = models.CharField(max_length=30, blank=True)
    pages = models.CharField(max_length=40, blank=True)
    article_number = models.CharField(max_length=40, blank=True)
    doi = models.CharField(max_length=200, unique=True, null=True, blank=True)
    url = models.URLField(blank=True)
    ieee_reference = models.TextField(blank=True)
    design = models.CharField(max_length=30, choices=Design.choices, default=Design.OTHER)
    population = models.CharField(
        max_length=30, choices=Population.choices, default=Population.OTHER
    )
    sample_size = models.PositiveIntegerField(null=True, blank=True)
    sample_size_note = models.CharField(max_length=200, blank=True)
    fluids = models.JSONField(default=list, blank=True, validators=[validate_fluids])
    platform = models.CharField(max_length=20, choices=Platform.choices, default=Platform.OTHER)
    review_section = models.CharField(
        max_length=30, choices=ReviewSection.choices, default=ReviewSection.INTRO
    )
    key_finding = models.TextField(blank=True)
    limitations = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    reading_status = models.CharField(
        max_length=10, choices=ReadingStatus.choices, default=ReadingStatus.TO_READ
    )
    tags = models.ManyToManyField(Tag, blank=True, related_name="papers")
    proteins = models.ManyToManyField(
        "proteins.Protein", through="Finding", related_name="papers", blank=True
    )

    class Meta:
        ordering = ["citation_number", "year", "title"]

    @property
    def short_label(self):
        return f"{self.first_author_surname} {self.year}".strip()

    def save(self, *args, **kwargs):
        self.doi = (self.doi or "").strip().lower() or None
        if not self.slug:
            base = f"{self.first_author_surname}-{self.year or ''}".strip("-") or self.title[:60]
            self.slug = unique_slug(self, base)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.short_label or self.title[:60]


class Finding(BaseModel):
    paper = models.ForeignKey(Paper, on_delete=models.CASCADE, related_name="findings")
    protein = models.ForeignKey(
        "proteins.Protein", on_delete=models.CASCADE, related_name="findings"
    )
    direction = models.CharField(max_length=20, choices=Direction.choices)
    context = models.CharField(
        max_length=40, choices=FindingContext.choices, default=FindingContext.OTHER
    )
    context_detail = models.CharField(max_length=300, blank=True)
    effect = models.CharField(max_length=300, blank=True)
    subgroup = models.CharField(max_length=300, blank=True)
    fluid = models.CharField(max_length=20, choices=Fluid.choices, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["paper__citation_number", "protein__name"]

    def __str__(self):
        return f"{self.paper} / {self.protein}: {self.direction}"
