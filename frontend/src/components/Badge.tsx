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
};
const label = (v: string) =>
  v.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export function Badge({ value, text }: { value: string; text?: string }) {
  return (
    <span className={`badge badge--${COLOURS[value] ?? "secondary"}`}>
      {text ?? label(value)}
    </span>
  );
}
export const humanise = label;
