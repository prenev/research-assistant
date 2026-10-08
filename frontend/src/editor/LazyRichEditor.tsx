import { forwardRef, lazy, Suspense } from "react";
import type { RichEditorHandle, RichEditorProps } from "./RichEditor";

const Inner = lazy(() =>
  import("./RichEditor").then((m) => ({ default: m.RichEditor })),
);

/** The editor (BlockNote + Mantine) is large, so it is only downloaded when someone edits. */
export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(
  function LazyRichEditor(props, ref) {
    return (
      <Suspense
        fallback={
          <div
            className={`rich-editor rich-editor--${props.variant ?? "inline"}`}
            aria-busy="true"
          >
            <p className="rich-editor__loading">Loading editor…</p>
          </div>
        }
      >
        <Inner {...props} ref={ref} />
      </Suspense>
    );
  },
);
export type { RichEditorHandle };
