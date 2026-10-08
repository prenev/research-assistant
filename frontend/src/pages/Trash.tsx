import { useQueryClient } from "@tanstack/react-query";
import { api, post } from "../api/client";
import { useQuery } from "@tanstack/react-query";
import { useFeedback } from "../components/Feedback";
import { PageShell } from "../components/PageShell";
import { humanise } from "../components/Badge";

interface TrashItem {
  type: string;
  id: number;
  title: string;
  deleted_at: string;
  days_left: number;
}

export function TrashPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["trash"],
    queryFn: () => api<TrashItem[]>("/trash/"),
  });
  const qc = useQueryClient();
  const { confirm, toast } = useFeedback();
  const refresh = () => qc.invalidateQueries();
  const restore = async (i: TrashItem) => {
    try {
      await post("/trash/", { type: i.type, id: i.id });
      toast(`Restored “${i.title}”`);
      refresh();
    } catch {
      toast("Could not restore that item", "error");
    }
  };
  const purge = async (i: TrashItem) => {
    if (
      !(await confirm(
        `Permanently delete “${i.title}”? This cannot be undone.`,
        { confirmLabel: "Delete forever" },
      ))
    )
      return;
    await api("/trash/", {
      method: "DELETE",
      body: JSON.stringify({ type: i.type, id: i.id }),
    });
    refresh();
  };
  return (
    <PageShell title="Trash">
      <p>Deleted items stay here for 30 days, then are removed for good.</p>
      {isLoading ? (
        <p>Loading…</p>
      ) : !data?.length ? (
        <div className="alert alert--info">The Trash is empty.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th>Deleted</th>
                <th>Days left</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((i) => (
                <tr key={`${i.type}-${i.id}`}>
                  <td>{i.title}</td>
                  <td>{humanise(i.type.replace(/-/g, "_"))}</td>
                  <td>{new Date(i.deleted_at).toLocaleDateString("en-GB")}</td>
                  <td>{i.days_left}</td>
                  <td>
                    <button
                      type="button"
                      className="button button--secondary button--sm"
                      onClick={() => restore(i)}
                    >
                      Restore
                    </button>{" "}
                    <button
                      type="button"
                      className="button button--danger button--outline button--sm"
                      onClick={() => purge(i)}
                    >
                      Delete forever
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
