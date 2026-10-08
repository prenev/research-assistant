import { Link } from "react-router-dom";
import { useSettings, useSidebar, useStats } from "../api/hooks";
import { Layout } from "../theme/Layout";
import { flattenPages } from "../theme/DocSidebar";

export function Home() {
  const { data: s } = useSettings();
  const { data: stats } = useStats();
  const { data: sidebar } = useSidebar();
  const first = sidebar && flattenPages(sidebar)[0];
  const cards = [
    {
      title: "Papers tracked",
      value: stats?.papers ?? "–",
      to: "/papers",
      note: "Literature with findings per protein",
    },
    {
      title: "Proteins tracked",
      value: stats?.proteins ?? "–",
      to: "/proteins",
      note: "Candidates and comparators",
    },
    {
      title: "Pipeline progress",
      value: stats ? `${stats.pipeline_progress_pct}%` : "–",
      to: "/pipeline",
      note: stats
        ? `${stats.pipeline_done} of ${stats.pipeline_stages} stages done`
        : "",
    },
  ];
  return (
    <Layout>
      <header className="hero hero--primary hero-banner">
        <div className="container">
          <h1 className="hero__title">{s?.site_title}</h1>
          <p className="hero__subtitle">{s?.tagline}</p>
          {s?.research_question && (
            <p className="hero-question">{s.research_question}</p>
          )}
          <div className="hero-buttons">
            <Link
              className="button button--secondary button--lg"
              to={first ? `/docs/${first.slug}` : "/docs"}
            >
              Read the docs
            </Link>
            <Link
              className="button button--secondary button--outline button--lg"
              to="/visualise/evidence-matrix"
            >
              Explore evidence
            </Link>
          </div>
        </div>
      </header>
      <main>
        <section className="container features">
          <div className="row">
            {cards.map((c) => (
              <div key={c.title} className="col col--4">
                <Link to={c.to} className="card padding--lg feature-card">
                  <div className="feature-card__value">{c.value}</div>
                  <h3>{c.title}</h3>
                  <p>{c.note}</p>
                </Link>
              </div>
            ))}
          </div>
          <div className="margin-top--lg">
            <h2>Recently edited</h2>
            {stats?.recently_edited.length ? (
              <ul>
                {stats.recently_edited.map((r) => (
                  <li key={r.url + r.type}>
                    <Link to={r.url}>{r.title}</Link>{" "}
                    <span className="badge badge--secondary">{r.type}</span>{" "}
                    <small>
                      {new Date(r.updated_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nothing yet.</p>
            )}
          </div>
        </section>
      </main>
    </Layout>
  );
}
