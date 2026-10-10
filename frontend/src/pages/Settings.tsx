import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useSettings } from "../api/hooks";
import type { SiteSettings } from "../api/types";
import { useFeedback } from "../components/Feedback";
import { PageShell } from "../components/PageShell";
import { useForms } from "../forms/FormHost";

export function SettingsPage() {
  const { data } = useSettings();
  const [v, setV] = useState<SiteSettings | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const qc = useQueryClient();
  const { toast } = useFeedback();
  const { openImport } = useForms();
  useEffect(() => data && setV((cur) => cur ?? data), [data]);
  if (!v)
    return (
      <PageShell title="Settings">
        <p>Loading…</p>
      </PageShell>
    );
  const set = <K extends keyof SiteSettings>(k: K, val: SiteSettings[K]) =>
    setV({ ...v, [k]: val });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const form = new FormData();
    for (const k of [
      "site_title",
      "tagline",
      "research_question",
      "primary_colour",
      "footer_text",
    ] as const)
      form.append(k, v[k] ?? "");
    form.append("public_read", String(v.public_read));
    form.append("min_event_count_warning", String(v.min_event_count_warning));
    form.append("weekly_reading_goal", String(v.weekly_reading_goal));
    if (logo) form.append("logo", logo);
    setErrors({});
    try {
      await api("/settings/", { method: "PUT", body: form });
      await qc.invalidateQueries({ queryKey: ["settings"] });
      setLogo(null);
      toast("Settings saved");
    } catch (err) {
      const body = (err as { body?: Record<string, unknown> }).body ?? {};
      setErrors(
        Object.fromEntries(
          Object.entries(body).map(([k, x]) => [
            k,
            Array.isArray(x) ? x.join(" ") : String(x),
          ]),
        ),
      );
      toast("Please fix the highlighted fields", "error");
    }
  };
  const row = (
    k: keyof SiteSettings,
    label: string,
    input: React.ReactNode,
    help?: string,
  ) => (
    <div className="form-row">
      <label htmlFor={`s-${k}`}>{label}</label>
      {input}
      {help && <small className="form-help">{help}</small>}
      {errors[k] && (
        <div className="field-error" role="alert">
          {errors[k]}
        </div>
      )}
    </div>
  );
  return (
    <PageShell title="Settings" narrow>
      <form className="model-form model-form--single" onSubmit={submit}>
        {row(
          "site_title",
          "Site title",
          <input
            id="s-site_title"
            className="field"
            value={v.site_title}
            onChange={(e) => set("site_title", e.target.value)}
          />,
        )}
        {row(
          "tagline",
          "Tagline",
          <input
            id="s-tagline"
            className="field"
            value={v.tagline}
            onChange={(e) => set("tagline", e.target.value)}
          />,
        )}
        {row(
          "research_question",
          "Research question",
          <textarea
            id="s-research_question"
            className="field"
            rows={3}
            value={v.research_question}
            onChange={(e) => set("research_question", e.target.value)}
          />,
        )}
        {row(
          "primary_colour",
          "Primary colour",
          <div className="colour-row">
            <input
              id="s-primary_colour"
              type="color"
              value={v.primary_colour}
              onChange={(e) => set("primary_colour", e.target.value)}
            />
            <code>{v.primary_colour}</code>
          </div>,
        )}
        {row(
          "logo",
          "Logo",
          <input
            id="s-logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
          />,
          v.logo
            ? "A logo is set. Choose a file to replace it."
            : "Optional. A simple placeholder is used otherwise.",
        )}
        {row(
          "footer_text",
          "Footer text",
          <input
            id="s-footer_text"
            className="field"
            value={v.footer_text}
            onChange={(e) => set("footer_text", e.target.value)}
          />,
        )}
        {row(
          "min_event_count_warning",
          "Minimum event count",
          <input
            id="s-min_event_count_warning"
            type="number"
            min={0}
            className="field"
            value={v.min_event_count_warning}
            onChange={(e) =>
              set("min_event_count_warning", Number(e.target.value))
            }
          />,
          "Results with fewer events need an explicit data-policy confirmation.",
        )}
        {row(
          "weekly_reading_goal",
          "Weekly reading goal",
          <input
            id="s-weekly_reading_goal"
            type="number"
            min={0}
            max={50}
            className="field"
            value={v.weekly_reading_goal}
            onChange={(e) => set("weekly_reading_goal", Number(e.target.value))}
          />,
          "Papers you aim to finish each week. It fills the ring on the home page. 0 turns it off.",
        )}
        <div className="form-row">
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={v.public_read}
              onChange={(e) => set("public_read", e.target.checked)}
            />{" "}
            Allow anyone to read the site without logging in
          </label>
          <small className="form-help">
            Writing always requires login. Leave off unless you want the
            notebook public.
          </small>
        </div>
        <button type="submit" className="button button--primary">
          Save settings
        </button>
      </form>

      <h2 className="margin-top--xl">Data</h2>
      <div className="data-actions">
        <a
          className="button button--secondary"
          href="/api/v1/export/json/"
          download
        >
          Download full backup (JSON)
        </a>
        <a
          className="button button--secondary"
          href="/api/v1/export/bibtex/"
          download
        >
          Papers as BibTeX
        </a>
        <a
          className="button button--secondary"
          href="/api/v1/export/ieee/"
          download
        >
          IEEE reference list
        </a>
        <button
          type="button"
          className="button button--secondary"
          onClick={openImport}
        >
          Import papers…
        </button>
        <Link className="button button--secondary" to="/trash">
          Trash
        </Link>
      </div>
    </PageShell>
  );
}
