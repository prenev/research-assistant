import type { Obj } from "../api/crud";

export type Kind =
  | "text"
  | "textarea"
  | "markdown"
  | "select"
  | "choices"
  | "relation"
  | "strings"
  | "bool"
  | "date"
  | "number"
  | "decimal";

export interface RelationDef {
  endpoint: string;
  label: (o: Obj) => string;
  multiple?: boolean;
  /** Body to POST when the user creates a new item from the typed text. */
  create?: (text: string) => Record<string, unknown>;
}

export interface FieldDef {
  name: string;
  label?: string;
  kind?: Kind;
  help?: string;
  relation?: RelationDef;
  choices?: { value: string; display_name: string }[];
  wide?: boolean;
  /** A heading shown above this field, to group a long form. */
  section?: string;
}

export interface ModelConfig {
  key: string;
  endpoint: string;
  singular: string;
  titleOf: (o: Obj) => string;
  fields: FieldDef[];
  defaults?: Record<string, unknown>;
}

const paperRel = (multiple = false): RelationDef => ({
  endpoint: "papers",
  multiple,
  label: (o) =>
    `${o.short_label || o.title}${o.citation_number ? ` [${o.citation_number}]` : ""}`,
  create: (t) => ({ title: t }),
});
const proteinRel = (multiple = false): RelationDef => ({
  endpoint: "proteins",
  multiple,
  label: (o) => o.name,
  create: (name) => ({ name }),
});
const tagRel: RelationDef = {
  endpoint: "tags",
  multiple: true,
  label: (o) => o.name,
  create: (name) => ({ name }),
};
const stageRel = (multiple = false): RelationDef => ({
  endpoint: "pipeline-stages",
  multiple,
  label: (o) => o.title,
});

export const FLUIDS = [
  { value: "plasma", display_name: "Plasma" },
  { value: "serum", display_name: "Serum" },
  { value: "csf", display_name: "CSF" },
  { value: "brain_tissue", display_name: "Brain tissue" },
  { value: "pet_imaging", display_name: "PET imaging" },
];

export const FTD_SUBTYPES = [
  { value: "bvftd", display_name: "bvFTD (behavioural variant)" },
  { value: "svppa", display_name: "svPPA (semantic variant)" },
  { value: "nfvppa", display_name: "nfvPPA (non-fluent variant)" },
  { value: "ftd_mnd", display_name: "FTD with motor neuron disease" },
  { value: "unspecified", display_name: "FTD, subtype not specified" },
];

export const MODELS: Record<string, ModelConfig> = {
  paper: {
    key: "paper",
    endpoint: "papers",
    singular: "paper",
    titleOf: (o) => o.short_label || o.title,
    defaults: { fluids: [], limitations: [] },
    fields: [
      { name: "title", section: "The paper", kind: "textarea", wide: true },
      { name: "authors", help: 'Display string, e.g. "M. Malpetti et al."' },
      { name: "first_author_surname", label: "First author surname" },
      { name: "year", kind: "number" },
      { name: "journal" },
      { name: "volume" },
      { name: "issue" },
      { name: "pages" },
      { name: "article_number", label: "Article number" },
      { name: "doi", label: "DOI" },
      { name: "url", label: "URL" },
      {
        name: "citation_number",
        label: "Citation number",
        kind: "number",
        help: "The number used in citations like {{cite:1}}",
      },
      {
        name: "ieee_reference",
        label: "IEEE reference",
        kind: "textarea",
        wide: true,
      },
      { name: "design", section: "Study design" },
      { name: "population" },
      { name: "sample_size", kind: "number" },
      { name: "sample_size_note", label: "Sample size note" },
      { name: "fluids", kind: "choices", choices: FLUIDS },
      { name: "platform" },
      {
        name: "condition_studied",
        section: "What was studied",
        label: "Condition studied",
        help: "FTD, dementia in general, or something else?",
      },
      {
        name: "ftd_subtypes",
        label: "FTD subtypes",
        kind: "choices",
        choices: FTD_SUBTYPES,
      },
      {
        name: "dataset",
        label: "Cohort / dataset",
        help: "e.g. UK Biobank, or the study's own cohort",
      },
      {
        name: "time_frame",
        label: "Time frame",
        help: "Follow-up length, or time from blood sample to diagnosis",
        wide: true,
      },
      { name: "nfl_involved", label: "NfL involved?" },
      {
        name: "case_identification",
        label: "How cases were identified",
        help: "e.g. clinical diagnosis, hospital records, registry codes",
        wide: true,
      },
      { name: "review_section", label: "Review section" },
      {
        name: "key_finding",
        section: "What it found",
        label: "Key finding",
        kind: "textarea",
        wide: true,
      },
      { name: "limitations", kind: "strings", wide: true },
      {
        name: "reading_status",
        section: "My assessment",
        label: "Reading status",
      },
      { name: "relevance", label: "Relevance to my project" },
      { name: "quality", label: "How much I trust it" },
      {
        name: "why_it_matters",
        label: "Why it matters",
        kind: "textarea",
        wide: true,
        help: "One or two lines on why this paper is useful to you",
      },
      {
        name: "methods_to_borrow",
        label: "Methods to borrow",
        kind: "textarea",
        wide: true,
      },
      {
        name: "extra_details",
        label: "Extra details",
        kind: "strings",
        wide: true,
        help: 'Anything else worth tracking, one per line as "Label: value", e.g. "Funding: none declared"',
      },
      { name: "tags", kind: "relation", relation: tagRel },
      { name: "notes", kind: "markdown", wide: true },
    ],
  },
  protein: {
    key: "protein",
    endpoint: "proteins",
    singular: "protein",
    titleOf: (o) => o.name,
    defaults: { aliases: [] },
    fields: [
      { name: "name" },
      { name: "aliases", kind: "strings", help: 'e.g. "CCL2" for MCP-1' },
      { name: "olink_assay_name", label: "Olink assay name" },
      { name: "category" },
      { name: "on_olink_panel", label: "On Olink panel" },
      { name: "role" },
      {
        name: "wikipedia_title",
        label: "Wikipedia article title",
        help: "Optional. Exact article title for the background view; blank finds it automatically.",
      },
      { name: "exclusion_reason", label: "Exclusion reason" },
      { name: "rationale", kind: "markdown", wide: true },
      { name: "notes", kind: "markdown", wide: true },
    ],
  },
  finding: {
    key: "finding",
    endpoint: "findings",
    singular: "finding",
    titleOf: (o) => `${o.paper_label ?? ""} / ${o.protein_name ?? ""}`,
    fields: [
      { name: "paper", kind: "relation", relation: paperRel() },
      { name: "protein", kind: "relation", relation: proteinRel() },
      { name: "direction" },
      { name: "context" },
      {
        name: "context_detail",
        label: "Context detail",
        help: 'e.g. "bvFTD vs controls, plasma"',
      },
      { name: "effect", help: 'Free text, e.g. "AUC 0.72"' },
      { name: "subgroup" },
      { name: "fluid" },
      { name: "notes", kind: "textarea", wide: true },
    ],
  },
  docPage: {
    key: "docPage",
    endpoint: "doc-pages",
    singular: "doc page",
    titleOf: (o) => o.title,
    fields: [
      { name: "title" },
      {
        name: "category",
        kind: "relation",
        relation: {
          endpoint: "doc-categories",
          label: (o) => o.title,
          create: (title) => ({ title }),
        },
      },
      { name: "description", wide: true },
      { name: "sidebar_label", label: "Sidebar label" },
      { name: "tags", kind: "relation", relation: tagRel },
      { name: "body", kind: "markdown", wide: true },
    ],
  },
  docCategory: {
    key: "docCategory",
    endpoint: "doc-categories",
    singular: "doc category",
    titleOf: (o) => o.title,
    fields: [
      { name: "title" },
      {
        name: "parent",
        kind: "relation",
        relation: { endpoint: "doc-categories", label: (o) => o.title },
        help: "Leave empty for a top-level category",
      },
      { name: "description", wide: true },
      {
        name: "collapsed_by_default",
        label: "Collapsed by default",
        kind: "bool",
      },
    ],
  },
  logPost: {
    key: "logPost",
    endpoint: "log-posts",
    singular: "log post",
    titleOf: (o) => o.title,
    fields: [
      { name: "title", wide: true },
      { name: "date", kind: "date" },
      { name: "tags", kind: "relation", relation: tagRel },
      {
        name: "linked_papers",
        label: "Linked papers",
        kind: "relation",
        relation: paperRel(true),
      },
      {
        name: "linked_proteins",
        label: "Linked proteins",
        kind: "relation",
        relation: proteinRel(true),
      },
      {
        name: "linked_pipeline_stages",
        label: "Linked pipeline stages",
        kind: "relation",
        relation: stageRel(true),
      },
      {
        name: "summary",
        kind: "textarea",
        wide: true,
        help: "Leave blank to use the first paragraph. Use <!-- truncate --> in the body to set the cut-off.",
      },
      { name: "body", kind: "markdown", wide: true },
    ],
  },
  decision: {
    key: "decision",
    endpoint: "decisions",
    singular: "decision",
    titleOf: (o) => o.title,
    fields: [
      { name: "title", wide: true },
      { name: "date", kind: "date" },
      { name: "status" },
      {
        name: "prespecified",
        kind: "bool",
        help: "Made before seeing outcome data",
      },
      {
        name: "related_stage",
        label: "Related stage",
        kind: "relation",
        relation: stageRel(),
      },
      {
        name: "superseded_by",
        label: "Superseded by",
        kind: "relation",
        relation: { endpoint: "decisions", label: (o) => o.title },
      },
      { name: "decision", kind: "textarea", wide: true },
      { name: "rationale", kind: "markdown", wide: true },
    ],
  },
  pipelineStage: {
    key: "pipelineStage",
    endpoint: "pipeline-stages",
    singular: "pipeline stage",
    titleOf: (o) => o.title,
    fields: [
      { name: "title", wide: true },
      { name: "status" },
      { name: "started_on", label: "Started on", kind: "date" },
      { name: "completed_on", label: "Completed on", kind: "date" },
      {
        name: "blocked_reason",
        label: "Blocked reason",
        help: "Only kept while the status is Blocked",
      },
      { name: "description", kind: "markdown", wide: true },
      { name: "notes", kind: "markdown", wide: true },
    ],
  },
  result: {
    key: "result",
    endpoint: "results",
    singular: "result",
    titleOf: (o) => o.title,
    fields: [
      { name: "title", wide: true },
      { name: "date", kind: "date" },
      { name: "model_label", label: "Model" },
      { name: "metric" },
      { name: "value", kind: "decimal" },
      { name: "ci_lower", label: "CI lower", kind: "decimal" },
      { name: "ci_upper", label: "CI upper", kind: "decimal" },
      { name: "horizon_years", label: "Horizon (years)", kind: "decimal" },
      { name: "n_participants", label: "Participants (n)", kind: "number" },
      { name: "n_events", label: "Events (n)", kind: "number" },
      {
        name: "linked_stage",
        label: "Linked stage",
        kind: "relation",
        relation: stageRel(),
      },
      { name: "notes", kind: "textarea", wide: true },
    ],
  },
};

export const QUICK_ADD: { label: string; model: string }[] = [
  { label: "Add paper", model: "paper" },
  { label: "Add protein", model: "protein" },
  { label: "Add finding", model: "finding" },
  { label: "New log post", model: "logPost" },
  { label: "New doc page", model: "docPage" },
  { label: "New decision", model: "decision" },
];
