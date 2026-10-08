const COLOURS: Record<string, string> = {
  // protein roles
  candidate: "info",
  comparator: "secondary",
  excluded: "danger",
  selected: "success",
  under_review: "warning",
  // reading status
  to_read: "secondary",
  reading: "warning",
  read: "info",
  cited: "success",
  // pipeline
  not_started: "secondary",
  in_progress: "info",
  blocked: "danger",
  done: "success",
  // decisions
  proposed: "warning",
  adopted: "success",
  superseded: "secondary",
  // relevance to my project
  core: "primary",
  useful: "info",
  background: "secondary",
  // how much I trust a paper
  high: "success",
  medium: "warning",
  low: "danger",
  // NfL involvement
  compared: "success",
  measured: "info",
  not_measured: "secondary",
  unclear: "warning",
};
const LABELS: Record<string, string> = {
  core: "Core",
  compared: "NfL compared",
  measured: "NfL measured",
  not_measured: "No NfL",
  unclear: "NfL unclear",
  high: "High trust",
  medium: "Medium trust",
  low: "Low trust",
};
const label = (v: string) =>
  v.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export function Badge({ value, text }: { value: string; text?: string }) {
  return (
    <span className={`badge badge--${COLOURS[value] ?? "secondary"}`}>
      {text ?? LABELS[value] ?? label(value)}
    </span>
  );
}
export const humanise = label;
