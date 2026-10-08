import { lazy, Suspense } from "react";

const Inner = lazy(() =>
  import("./RichEditor").then((m) => ({ default: m.RichEditor })),
);

/** The editor (BlockNote + Mantine) is large, so it is only downloaded when someone edits. */
export function RichEditor(props: {
  value: string;
  onChange: (markdown: string) => void;
  label?: string;
}) {
  return (
    <Suspense
      fallback={
        <div className="rich-editor" aria-busy="true">
          <p className="padding--md">Loading editor…</p>
        </div>
      }
    >
      <Inner {...props} />
    </Suspense>
  );
}
