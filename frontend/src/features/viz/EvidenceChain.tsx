import { useState } from "react";
import { Link } from "react-router-dom";
import { api, post } from "../../api/client";
import { refreshAfterWrite } from "../../api/crud";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { useFeedback } from "../../components/Feedback";
import { useMe } from "../../api/hooks";
import { useViz, type ChainData } from "./data";
import { SvgTable } from "./SvgTable";
import { VizFrame } from "./VizFrame";

// Status colours are reserved and always come with an icon and a word.
const MET = {
  yes: { icon: "✓", label: "Yes", colour: "var(--viz-predictive)" },
  partial: { icon: "◐", label: "Partial", colour: "var(--viz-raised)" },
  no: { icon: "✕", label: "No", colour: "var(--viz-ink-3)" },
  unset: { icon: "–", label: "Not assessed", colour: "var(--viz-ink-3)" },
} as const;
type Met = keyof typeof MET;

export function EvidenceChain({ embedded }: { embedded?: boolean }) {
  const { data, isLoading } = useViz<ChainData>("evidence-chain");
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { toast } = useFeedback();
  const [edit, setEdit] = useState<{ paperId: number; reqId: number } | null>(
    null,
  );
  const [met, setMet] = useState<Met>("unset");
  const [why, setWhy] = useState("");

  const open = (paperId: number, reqId: number) => {
    const cur = data?.papers.find((p) => p.id === paperId)?.assessments[reqId];
    setMet((cur?.met as Met) ?? "unset");
    setWhy(cur?.justification ?? "");
    setEdit({ paperId, reqId });
  };
  const save = async () => {
    if (!edit || !data) return;
    const cur = data.papers.find((p) => p.id === edit.paperId)?.assessments[
      edit.reqId
    ];
    try {
      if (met === "unset") {
        if (cur)
          await api(`/requirement-assessments/${cur.id}/`, {
            method: "DELETE",
          });
      } else if (cur) {
        await api(`/requirement-assessments/${cur.id}/`, {
          method: "PATCH",
          body: JSON.stringify({ met, justification: why }),
        });
      } else {
        await post("/requirement-assessments/", {
          paper: edit.paperId,
          requirement: edit.reqId,
          met,
          justification: why,
        });
      }
      refreshAfterWrite(qc);
      toast("Assessment saved");
      setEdit(null);
    } catch {
      toast("Could not save that assessment", "error");
    }
  };

  const empty =
    !isLoading &&
    (!data || data.papers.length === 0 || data.requirements.length === 0);
  const editing = edit &&
    data && {
      paper: data.papers.find((p) => p.id === edit.paperId)!,
      req: data.requirements.find((r) => r.id === edit.reqId)!,
    };

  return (
    <VizFrame
      title="Evidence chain"
      description="Does any paper meet all five requirements for your research question? Click a cell to assess a paper against a requirement."
      fileName="evidence-chain"
      embedded={embedded}
      empty={empty}
      emptyHint="Add papers, and the five requirements will appear as columns."
    >
      {isLoading || !data ? (
        <p>Loading…</p>
      ) : (
        <>
          <div className="table-wrap viz__scroll">
            <table>
              <thead>
                <tr>
                  <th>Paper</th>
                  {data.requirements.map((r) => (
                    <th key={r.id} title={r.description || r.title}>
                      R{r.number}
                      <div className="table-sub">{r.title}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.papers.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/papers/${p.slug}`}>{p.label}</Link>
                      {p.citation_number ? ` [${p.citation_number}]` : ""}
                    </td>
                    {data.requirements.map((r) => {
                      const a = p.assessments[r.id];
                      const m = MET[(a?.met as Met) ?? "unset"];
                      const cell = (
                        <>
                          <span
                            style={{ color: m.colour, fontWeight: 700 }}
                            aria-hidden="true"
                          >
                            {m.icon}
                          </span>{" "}
                          {m.label}
                        </>
                      );
                      return (
                        <td key={r.id} title={a?.justification || undefined}>
                          {me?.authenticated ? (
                            <button
                              type="button"
                              className="clean-btn viz-focus"
                              onClick={() => open(p.id, r.id)}
                              aria-label={`${p.label}, requirement ${r.number}: ${m.label}. Change`}
                            >
                              {cell}
                            </button>
                          ) : (
                            cell
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Papers meeting it</th>
                  {data.requirements.map((r) => {
                    const t = data.totals.find((x) => x.requirement === r.id)!;
                    return (
                      <th key={r.id}>
                        {t.yes} yes · {t.partial} partial
                      </th>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
          <div
            className={`alert alert--${data.any_meets_all ? "success" : "info"} margin-top--md`}
            role="status"
          >
            {data.any_meets_all ? (
              <>
                <strong>
                  ✓ {data.meets_all.length} paper
                  {data.meets_all.length === 1 ? " meets" : "s meet"} all five
                  requirements:
                </strong>{" "}
                {data.meets_all.map((p) => p.label).join(", ")}. Check whether
                there is still a gap for this project.
              </>
            ) : (
              <>
                <strong>No paper meets all five requirements yet.</strong> That
                is the research gap this project aims to fill (assuming the
                assessments above are complete).
              </>
            )}
          </div>
          <SvgTable
            title="Evidence chain"
            headers={["Paper", ...data.requirements.map((r) => `R${r.number}`)]}
            rows={data.papers.map((p) => ({
              cells: [
                p.label,
                ...data.requirements.map(
                  (r) =>
                    MET[(p.assessments[r.id]?.met as Met) ?? "unset"].label,
                ),
              ],
              fills: [
                undefined,
                ...data.requirements.map(
                  (r) =>
                    MET[(p.assessments[r.id]?.met as Met) ?? "unset"].colour,
                ),
              ],
            }))}
          />
          {editing && (
            <Modal
              title={`${editing.paper.label} · R${editing.req.number}`}
              onClose={() => setEdit(null)}
              footer={
                <>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setEdit(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={save}
                  >
                    Save
                  </button>
                </>
              }
            >
              <p>
                <strong>{editing.req.title}</strong>
                {editing.req.description ? `: ${editing.req.description}` : ""}
              </p>
              <div className="form-row">
                <label htmlFor="chain-met">
                  Does the paper meet this requirement?
                </label>
                <select
                  id="chain-met"
                  className="field"
                  value={met}
                  onChange={(e) => setMet(e.target.value as Met)}
                >
                  {(Object.keys(MET) as Met[]).map((k) => (
                    <option key={k} value={k}>
                      {MET[k].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row margin-top--md">
                <label htmlFor="chain-why">Why</label>
                <textarea
                  id="chain-why"
                  className="field"
                  rows={4}
                  value={why}
                  onChange={(e) => setWhy(e.target.value)}
                  placeholder="One or two lines on what in the paper supports this"
                />
              </div>
            </Modal>
          )}
        </>
      )}
    </VizFrame>
  );
}
