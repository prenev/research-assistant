import { Link } from "react-router-dom";
import { useStats } from "../../api/hooks";
import { useViz, type DashboardData } from "../viz/data";
import { buildGrid, ringFraction } from "./heatmap";

const LEVEL_FILL = [
  "var(--viz-grid)",
  "var(--viz-seq-1)",
  "var(--viz-seq-2)",
  "var(--viz-seq-3)",
  "var(--viz-seq-4)",
];
const CELL = 12,
  GAP = 3;

function Ring({
  value,
  goal,
  label,
}: {
  value: number;
  goal: number;
  label: string;
}) {
  const r = 38,
    c = 2 * Math.PI * r;
  const f = ringFraction(value, goal);
  return (
    <svg
      className="ring"
      width="104"
      height="104"
      viewBox="0 0 104 104"
      role="img"
      aria-label={label}
    >
      <circle
        cx="52"
        cy="52"
        r={r}
        fill="none"
        stroke="var(--viz-grid)"
        strokeWidth="9"
      />
      <circle
        cx="52"
        cy="52"
        r={r}
        fill="none"
        stroke="var(--ifm-color-primary)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${c * f} ${c}`}
        transform="rotate(-90 52 52)"
      />
      <text
        x="52"
        y="58"
        textAnchor="middle"
        fontSize="22"
        className="viz-strong"
      >
        {goal > 0 ? `${value}/${goal}` : value}
      </text>
    </svg>
  );
}

function Activity({ d }: { d: DashboardData }) {
  const { days, months } = buildGrid(d.activity, d.today);
  const cols = Math.max(...days.map((x) => x.col)) + 1;
  const width = 28 + cols * (CELL + GAP);
  const height = 20 + 7 * (CELL + GAP);
  const total = d.activity.reduce((n, a) => n + a.count, 0);
  const activeDays = d.activity.filter((a) => a.count > 0).length;
  return (
    <>
      <svg
        className="activity-grid"
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ maxWidth: width }}
        role="img"
        aria-label={`Activity over the last 26 weeks: ${total} edits on ${activeDays} days`}
      >
        {months.map((m) => (
          <text
            key={m.col}
            x={28 + m.col * (CELL + GAP)}
            y={10}
            className="viz-muted"
          >
            {m.label}
          </text>
        ))}
        {["Mon", "Wed", "Fri"].map((l, i) => (
          <text
            key={l}
            x={0}
            y={20 + i * 2 * (CELL + GAP) + CELL - 2}
            className="viz-muted"
          >
            {l}
          </text>
        ))}
        {days.map((x) => (
          <rect
            key={x.date}
            x={28 + x.col * (CELL + GAP)}
            y={16 + x.row * (CELL + GAP)}
            width={CELL}
            height={CELL}
            rx={2.5}
            fill={LEVEL_FILL[x.level]}
            stroke={x.date === d.today ? "var(--ifm-color-primary)" : "none"}
            strokeWidth={1.5}
          >
            <title>{`${x.date}: ${x.count} edit${x.count === 1 ? "" : "s"}`}</title>
          </rect>
        ))}
      </svg>
      <ul className="viz-legend" aria-label="Activity scale">
        <li>Less</li>
        {LEVEL_FILL.map((f, i) => (
          <li key={i}>
            <svg width="12" height="12" aria-hidden="true">
              <rect width="12" height="12" rx="2.5" fill={f} />
            </svg>
          </li>
        ))}
        <li>More</li>
      </ul>
    </>
  );
}

export function Dashboard() {
  const { data: d, isLoading } = useViz<DashboardData>("dashboard");
  const { data: stats } = useStats();
  if (isLoading || !d) return null;
  const goalOn = d.week.goal > 0;
  const left = Math.max(d.week.goal - d.week.finished, 0);
  const doneMilestones = d.milestones.filter((m) => m.done).length;

  return (
    <section className="container dash-wrap" aria-label="Your progress">
      <h2 className="margin-top--lg">Your progress</h2>
      <div className="dash">
        <div className="dash__card dash__third">
          <h3>This week</h3>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <Ring
              value={d.week.finished}
              goal={d.week.goal}
              label={
                goalOn
                  ? `${d.week.finished} of ${d.week.goal} papers finished this week`
                  : `${d.week.finished} papers finished this week`
              }
            />
            <div>
              <strong>
                {goalOn
                  ? left === 0
                    ? "Goal reached"
                    : `${left} more to reach your goal`
                  : "Papers finished"}
              </strong>
              <div className="table-sub">
                {goalOn
                  ? "papers finished this week"
                  : "this week. Set a weekly goal in Settings."}
              </div>
              <div className="table-sub">
                {d.week.edits} edit{d.week.edits === 1 ? "" : "s"} this week
              </div>
            </div>
          </div>
        </div>
        <div className="dash__card dash__twothirds">
          <h3>Streak</h3>
          <div
            style={{
              display: "flex",
              gap: "1.5rem",
              alignItems: "baseline",
              flexWrap: "wrap",
              marginBottom: "0.5rem",
            }}
          >
            <div>
              <span className="kpi">{d.streak.current}</span>{" "}
              <span>day{d.streak.current === 1 ? "" : "s"} in a row</span>
            </div>
            <div className="table-sub">Longest: {d.streak.longest}</div>
            {d.streak.at_risk && (
              <div className="table-sub" role="status">
                <strong>Do something today to keep your streak.</strong>
              </div>
            )}
          </div>
          <Activity d={d} />
        </div>
        <div className="dash__card dash__half">
          <h3>Next best actions</h3>
          {d.next_actions.length === 0 ? (
            <p>You are up to date. Nice.</p>
          ) : (
            <ul className="action-list">
              {d.next_actions.map((a) => (
                <li key={a.title}>
                  <Link to={a.url}>
                    <strong>{a.title}</strong>
                  </Link>
                  <small>{a.detail}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="dash__card dash__half">
          <h3>
            Milestones{" "}
            <span className="table-sub">
              {doneMilestones} of {d.milestones.length}
            </span>
          </h3>
          <ul className="milestone-list">
            {d.milestones.map((m) => (
              <li key={m.key} className={m.done ? "done" : ""}>
                <span aria-hidden="true">{m.done ? "✓" : "○"}</span>
                <span style={{ flex: 1 }}>
                  {m.label}
                  <span className="sr-only">
                    {m.done ? " (done)" : ` (${m.current} of ${m.target})`}
                  </span>
                </span>
                {!m.done && (
                  <>
                    <span className="milestone-bar" aria-hidden="true">
                      <span
                        style={{ width: `${(100 * m.current) / m.target}%` }}
                      />
                    </span>
                    <small aria-hidden="true">
                      {m.current}/{m.target}
                    </small>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="dash__card dash__third">
          <div className="kpi">
            {d.reading.read}
            <span className="table-sub"> / {d.reading.total}</span>
          </div>
          <h3>Papers read</h3>
          <div className="table-sub">
            {d.reading.reading} reading · {d.reading.to_read} to read
          </div>
        </div>
        <div className="dash__card dash__third">
          <div className="kpi">{d.evidence.findings}</div>
          <h3>Findings recorded</h3>
          <div className="table-sub">
            {d.evidence.proteins_with_findings} of {d.evidence.proteins}{" "}
            proteins have evidence
          </div>
        </div>
        <div className="dash__card dash__third">
          <div className="kpi">{stats?.pipeline_progress_pct ?? 0}%</div>
          <h3>Pipeline done</h3>
          <div className="table-sub">
            <Link to="/pipeline">
              {stats?.pipeline_done ?? 0} of {stats?.pipeline_stages ?? 0} steps
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
