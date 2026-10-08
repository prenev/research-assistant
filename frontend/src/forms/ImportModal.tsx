import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, post } from "../api/client";
import { Modal } from "../components/Modal";
import { useFeedback } from "../components/Feedback";

interface Entry {
  title: string;
  authors: string;
  year: number | null;
  journal: string;
  doi: string;
  duplicate: boolean;
  [k: string]: unknown;
}

export function ImportModal({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<"bibtex" | "zotero-csv">("bibtex");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const { toast } = useFeedback();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await api<{ entries: Entry[] }>(`/import/${kind}/`, {
        method: "POST",
        body: form,
      });
      setEntries(r.entries);
      setPicked(new Set(r.entries.flatMap((e, i) => (e.duplicate ? [] : [i]))));
    } catch (e) {
      const body = (e as { body?: { detail?: string } }).body;
      setError(body?.detail ?? "Could not read that file.");
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!entries) return;
    setBusy(true);
    try {
      const r = await post<{ created: number[]; skipped: unknown[] }>(
        `/import/${kind}/confirm/`,
        {
          entries: entries.filter((_, i) => picked.has(i)),
        },
      );
      await qc.invalidateQueries();
      toast(
        `Imported ${r.created.length} paper${r.created.length === 1 ? "" : "s"}${r.skipped.length ? `, skipped ${r.skipped.length}` : ""}`,
      );
      onClose();
    } catch {
      setError("Import failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Import papers"
      onClose={onClose}
      wide
      footer={
        entries && (
          <button
            type="button"
            className="button button--primary"
            disabled={busy || picked.size === 0}
            onClick={confirmImport}
          >
            Import {picked.size} selected
          </button>
        )
      }
    >
      {!entries ? (
        <>
          <div className="form-row">
            <label htmlFor="imp-kind">Format</label>
            <select
              id="imp-kind"
              className="field"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="bibtex">BibTeX (.bib)</option>
              <option value="zotero-csv">Zotero CSV export</option>
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="imp-file">File</label>
            <input
              id="imp-file"
              type="file"
              accept=".bib,.bibtex,.csv,text/csv,text/plain"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </div>
          <p className="form-help">
            This only imports literature references. Never upload participant
            data.
          </p>
          {busy && <p>Reading…</p>}
          {error && (
            <div className="alert alert--danger" role="alert">
              {error}
            </div>
          )}
        </>
      ) : (
        <>
          <p>
            {entries.length} entries found. Duplicates (same DOI) are unticked.
            Choose what to import.
          </p>
          <table className="import-table">
            <thead>
              <tr>
                <th>
                  <span className="sr-only">Import</span>
                </th>
                <th>Title</th>
                <th>Authors</th>
                <th>Year</th>
                <th>DOI</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Import ${e.title}`}
                      checked={picked.has(i)}
                      onChange={() =>
                        setPicked((p) => {
                          const n = new Set(p);
                          n.has(i) ? n.delete(i) : n.add(i);
                          return n;
                        })
                      }
                    />
                  </td>
                  <td>
                    {e.title}
                    {e.duplicate && (
                      <span className="badge badge--warning margin-left--sm">
                        duplicate
                      </span>
                    )}
                  </td>
                  <td>{e.authors}</td>
                  <td>{e.year}</td>
                  <td>{e.doi}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {error && (
            <div className="alert alert--danger" role="alert">
              {error}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
