import { Link, Route, Routes } from "react-router-dom";
import { EvidenceChain } from "../features/viz/EvidenceChain";
import { EvidenceMatrix } from "../features/viz/EvidenceMatrix";
import { FilterPanel, useVizFilters } from "../features/viz/filters";
import { GapMap } from "../features/viz/GapMap";
import { Network } from "../features/viz/Network";
import { ResultsPanel } from "../features/viz/ResultsPanel";
import { Timeline } from "../features/viz/Timeline";
import { Layout } from "../theme/Layout";

export const VIZ_LIST = [
  {
    to: "evidence-matrix",
    title: "Evidence matrix",
    blurb: "Which papers found what for each protein.",
  },
  {
    to: "gap-map",
    title: "Gap map",
    blurb: "Where the literature is thin, and where this project sits.",
  },
  {
    to: "network",
    title: "Network",
    blurb: "Proteins and papers linked by findings.",
  },
  {
    to: "timeline",
    title: "Timeline",
    blurb: "When and how large: papers by year and sample size.",
  },
  {
    to: "evidence-chain",
    title: "Evidence chain",
    blurb: "Does any paper meet all five requirements?",
  },
  {
    to: "results",
    title: "Results",
    blurb: "Aggregate results with confidence intervals.",
  },
];

function Shell({
  title,
  children,
  side,
}: {
  title: string;
  children: React.ReactNode;
  side?: React.ReactNode;
}) {
  return (
    <Layout title={title}>
      <main className="container margin-vert--lg">
        <nav aria-label="Breadcrumbs" className="margin-bottom--md">
          <Link to="/visualise">Visualise</Link> › {title}
        </nav>
        <div className="viz-layout">
          <div>{children}</div>
          {side}
        </div>
      </main>
    </Layout>
  );
}

function Filtered({
  title,
  names,
  children,
  extra,
}: {
  title: string;
  names?: readonly string[];
  children: (q: string, f: ReturnType<typeof useVizFilters>) => React.ReactNode;
  extra?: (f: ReturnType<typeof useVizFilters>) => React.ReactNode;
}) {
  const f = useVizFilters(names ? [...names, "include_empty"] : undefined);
  return (
    <Shell
      title={title}
      side={
        <FilterPanel
          values={f.values}
          onChange={f.set}
          onClear={f.clear}
          names={names}
        >
          {extra?.(f)}
        </FilterPanel>
      }
    >
      {children(f.query, f)}
    </Shell>
  );
}

export default function Visualise() {
  return (
    <Routes>
      <Route
        index
        element={
          <Layout title="Visualise">
            <main className="container margin-vert--lg">
              <h1>Visualise</h1>
              <p>
                Live views of the evidence. They update as you add papers and
                findings, and every one can be exported as PNG or SVG or
                embedded in a doc or log post.
              </p>
              <div className="row">
                {VIZ_LIST.map((v) => (
                  <div key={v.to} className="col col--4 margin-bottom--lg">
                    <Link
                      className="card padding--lg doc-card"
                      to={`/visualise/${v.to}`}
                    >
                      <h2>{v.title}</h2>
                      <p>{v.blurb}</p>
                    </Link>
                  </div>
                ))}
              </div>
              <p className="table-sub">
                Embed any of them with a shortcode such as{" "}
                <code>
                  {"{{viz:evidence-matrix population=general_population}}"}
                </code>
                .
              </p>
            </main>
          </Layout>
        }
      />
      <Route
        path="evidence-matrix"
        element={
          <Filtered
            title="Evidence matrix"
            extra={(f) => (
              <label className="checkbox-line margin-top--sm">
                <input
                  type="checkbox"
                  checked={f.searchParams.get("include_empty") === "1"}
                  onChange={(e) =>
                    f.set("include_empty", e.target.checked ? "1" : "")
                  }
                />
                Show proteins with no findings
              </label>
            )}
          >
            {(q, f) => (
              <EvidenceMatrix
                query={q.replace(/&?include_empty=1/, "")}
                includeEmpty={f.searchParams.get("include_empty") === "1"}
              />
            )}
          </Filtered>
        }
      />
      <Route
        path="network"
        element={
          <Filtered title="Network">{(q) => <Network query={q} />}</Filtered>
        }
      />
      <Route
        path="timeline"
        element={
          <Filtered title="Timeline" names={["population", "design", "fluid"]}>
            {(q) => <Timeline query={q} />}
          </Filtered>
        }
      />
      <Route
        path="gap-map"
        element={
          <Shell title="Gap map">
            <GapMap />
          </Shell>
        }
      />
      <Route
        path="evidence-chain"
        element={
          <Shell title="Evidence chain">
            <EvidenceChain />
          </Shell>
        }
      />
      <Route
        path="results"
        element={
          <Shell title="Results">
            <ResultsPanel />
          </Shell>
        }
      />
    </Routes>
  );
}
