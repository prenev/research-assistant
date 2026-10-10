import { useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { exportPng, exportSvg } from "./export";
import { useFeedback } from "../../components/Feedback";
import { useEditMode } from "../../theme/EditMode";

/** Title, export buttons, the chart, legend and a text/table alternative. Shows an empty state with a quick-add link. */
export function VizFrame({
  title,
  description,
  fileName,
  empty,
  emptyHint,
  legend,
  table,
  tools,
  embedded,
  children,
  exportable = true,
}: {
  title: string;
  description?: string;
  fileName: string;
  empty?: boolean;
  emptyHint?: ReactNode;
  legend?: ReactNode;
  table?: ReactNode;
  tools?: ReactNode;
  embedded?: boolean;
  children: ReactNode;
  exportable?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const { toast } = useFeedback();
  const { editing } = useEditMode();
  const svg = () =>
    box.current?.querySelector<SVGSVGElement>("svg[data-export]") ?? null;
  const run = async (kind: "svg" | "png") => {
    const el = svg();
    if (!el) return toast("Nothing to export yet", "error");
    try {
      if (kind === "svg") exportSvg(el, fileName);
      else await exportPng(el, fileName);
    } catch {
      toast("Could not export the image", "error");
    }
  };
  return (
    <section
      className={`viz${embedded ? " viz--embedded" : ""}`}
      aria-label={title}
      ref={box}
    >
      <div className="viz__head">
        <div>
          <h2 className="viz__title">{title}</h2>
          {description && <p className="viz__desc">{description}</p>}
        </div>
        <div className="viz__tools">
          {tools}
          {exportable && !empty && (
            <>
              <button
                type="button"
                className="button button--secondary button--sm"
                onClick={() => run("png")}
              >
                Export PNG
              </button>
              <button
                type="button"
                className="button button--secondary button--sm"
                onClick={() => run("svg")}
              >
                Export SVG
              </button>
            </>
          )}
        </div>
      </div>
      {empty ? (
        <div className="viz-empty" role="status">
          <h3>Nothing to show yet</h3>
          <p>{emptyHint}</p>
          <p>
            {editing ? (
              "Use ＋ in the navbar to add one."
            ) : (
              <>
                Turn on edit mode (pencil, top right), then use ＋. Or go to{" "}
                <Link to="/papers">Papers</Link>.
              </>
            )}
          </p>
        </div>
      ) : (
        <>
          {children}
          {legend}
          {table && (
            <details className="viz-table">
              <summary>View as a table</summary>
              {table}
            </details>
          )}
        </>
      )}
    </section>
  );
}
