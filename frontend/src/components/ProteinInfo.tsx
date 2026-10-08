import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useForms } from "../forms/FormHost";
import { useEditMode } from "../theme/EditMode";
import { Modal } from "./Modal";

export interface WikiImage {
  title: string;
  caption: string;
  thumb: string;
  full: string;
}
export interface WikiArticle {
  found: boolean;
  error?: string;
  detail?: string;
  title?: string;
  summary?: string;
  sections?: { title: string; text: string }[];
  images?: WikiImage[];
  matched_by?: "explicit" | "search";
  source_url?: string;
  attribution?: string;
  license?: { name: string; url: string };
}
export type ProteinRef = { id: number; name: string; slug: string };

const paragraphs = (t: string) =>
  t
    .split(/\n{2,}|\n/)
    .map((s) => s.trim())
    .filter(Boolean);

function Lightbox({
  images,
  index,
  onClose,
  onIndex,
}: {
  images: WikiImage[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const img = images[index];
  const step = (d: number) =>
    onIndex((index + d + images.length) % images.length);
  return (
    <Modal title={img.caption || "Image"} onClose={onClose} wide>
      <figure
        className="lightbox"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
      >
        <img src={img.full} alt={img.caption} />
        <figcaption>
          {img.caption}{" "}
          <small>
            ({index + 1} of {images.length})
          </small>
        </figcaption>
        {images.length > 1 && (
          <div className="lightbox__nav">
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={() => step(-1)}
            >
              ← Previous
            </button>
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={() => step(1)}
            >
              Next →
            </button>
          </div>
        )}
      </figure>
    </Modal>
  );
}

/** Background on a protein from Wikipedia, shown inside the app. Nothing here navigates away. */
export function ProteinInfoPanel({ protein }: { protein: ProteinRef }) {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["wiki", protein.id],
    staleTime: 60 * 60 * 1000,
    queryFn: () => api<WikiArticle>(`/proteins/${protein.id}/wikipedia/`),
  });
  const { editing } = useEditMode();
  const { openForm } = useForms();
  const [shot, setShot] = useState<number | null>(null);

  if (isLoading)
    return (
      <div className="wiki wiki--loading" aria-busy="true" role="status">
        Loading background information…
      </div>
    );
  if (!data?.found)
    return (
      <div className="wiki">
        <div
          className={`alert alert--${data?.error ? "warning" : "info"}`}
          role="status"
        >
          {data?.error
            ? "Wikipedia could not be reached just now. Try again in a moment."
            : `No Wikipedia article was found for ${protein.name}.`}
        </div>
        <div className="wiki__actions">
          {data?.error && (
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              Try again
            </button>
          )}
          {!data?.error && editing && (
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={() => openForm("protein", { id: protein.id })}
            >
              Set the article title
            </button>
          )}
        </div>
      </div>
    );

  const images = data.images ?? [];
  const intro = paragraphs(data.summary ?? "");
  return (
    <div className="wiki">
      <h3 className="wiki__title">{data.title}</h3>
      {data.matched_by === "search" && (
        <p className="table-sub">
          Found automatically. If this is the wrong article,{" "}
          {editing
            ? "edit the protein and set the Wikipedia article title."
            : "turn on edit mode and set the article title."}
        </p>
      )}
      <div className="wiki__intro">
        {images[0] && (
          <button
            type="button"
            className="clean-btn wiki__hero"
            onClick={() => setShot(0)}
            aria-label={`Enlarge image: ${images[0].caption}`}
          >
            <img src={images[0].thumb} alt={images[0].caption} loading="lazy" />
            <span>{images[0].caption}</span>
          </button>
        )}
        {intro.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {images.length > 1 && (
        <section aria-label="Images">
          <h4>Images</h4>
          <ul className="wiki__gallery">
            {images.map((im, i) => (
              <li key={im.title}>
                <button
                  type="button"
                  className="clean-btn"
                  onClick={() => setShot(i)}
                  aria-label={`Enlarge image: ${im.caption}`}
                >
                  <img src={im.thumb} alt={im.caption} loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(data.sections ?? []).map((s) => (
        <details key={s.title} className="wiki__section">
          <summary>{s.title}</summary>
          {paragraphs(s.text).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </details>
      ))}
      <p className="wiki__attribution">
        {data.attribution}{" "}
        {data.source_url && (
          <a href={data.source_url} target="_blank" rel="noopener noreferrer">
            Source article
          </a>
        )}{" "}
        ·{" "}
        <a href={data.license?.url} target="_blank" rel="noopener noreferrer">
          {data.license?.name}
        </a>
      </p>
      {shot !== null && (
        <Lightbox
          images={images}
          index={shot}
          onIndex={setShot}
          onClose={() => setShot(null)}
        />
      )}
    </div>
  );
}

/** Opens the info view for a protein in a modal. Tapping never leaves the page. */
export function ProteinInfoModal({
  protein,
  onClose,
}: {
  protein: ProteinRef;
  onClose: () => void;
}) {
  return (
    <Modal
      title={`About ${protein.name}`}
      onClose={onClose}
      wide
      footer={
        <Link
          className="button button--secondary"
          to={`/proteins/${protein.slug}`}
          onClick={onClose}
        >
          Open full profile
        </Link>
      }
    >
      <ProteinInfoPanel protein={protein} />
    </Modal>
  );
}

export function ProteinInfoButton({ protein }: { protein: ProteinRef }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="button button--secondary button--outline button--sm"
        onClick={() => setOpen(true)}
        aria-label={`About ${protein.name}`}
        aria-haspopup="dialog"
      >
        ⓘ Info
      </button>
      {open && (
        <ProteinInfoModal protein={protein} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
