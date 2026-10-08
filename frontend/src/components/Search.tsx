import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import {
  excerpt,
  highlightParts,
  makeFuse,
  searchGrouped,
  type SearchDoc,
} from "../lib/search";

const SearchCtx = createContext<{ open: () => void }>({ open: () => {} });
export const useSearch = () => useContext(SearchCtx);

function Highlight({
  text,
  indices,
}: {
  text: string;
  indices?: readonly [number, number][];
}) {
  return (
    <>
      {highlightParts(text, indices).map((p, i) =>
        p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>,
      )}
    </>
  );
}

function SearchModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  // Always refetch on open, so anything just created or edited is searchable straight away.
  const { data, isLoading } = useQuery({
    queryKey: ["search-index"],
    queryFn: () => api<SearchDoc[]>("/search-index/"),
    staleTime: 0,
    gcTime: 0,
  });
  const fuse = useMemo(() => makeFuse(data ?? []), [data]);
  const groups = useMemo(() => searchGrouped(fuse, q), [fuse, q]);
  const flat = groups.flatMap((g) => g.hits);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (url: string) => {
    onClose();
    navigate(url);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && flat[active]) {
      e.preventDefault();
      go(flat[active].item.url);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  let idx = -1;
  return (
    <div
      className="search-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="search-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onKeyDown={onKey}
      >
        <div className="search-modal__input">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M14.386 14.386l4.0877 4.0877-4.0877-4.0877c-2.9418 2.9419-7.7115 2.9419-10.6533 0-2.9419-2.9418-2.9419-7.7115 0-10.6533 2.9418-2.9419 7.7115-2.9419 10.6533 0 2.9419 2.9418 2.9419 7.7115 0 10.6533z"
              stroke="currentColor"
              fill="none"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input
            autoFocus
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls="search-results"
            aria-activedescendant={
              flat.length ? `search-hit-${active}` : undefined
            }
            aria-label="Search docs, papers, proteins, log and decisions"
            placeholder="Search docs, papers, proteins, log, decisions"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <kbd>esc</kbd>
        </div>
        <div
          className="search-modal__results"
          id="search-results"
          role="listbox"
          ref={listRef}
        >
          {isLoading && <p className="search-modal__msg">Loading…</p>}
          {!isLoading && q.trim().length < 2 && (
            <p className="search-modal__msg">Type at least two characters.</p>
          )}
          {!isLoading && q.trim().length >= 2 && groups.length === 0 && (
            <p className="search-modal__msg">No results for “{q.trim()}”.</p>
          )}
          {groups.map((g) => (
            <section key={g.type} aria-label={g.label}>
              <h3 className="search-group">{g.label}</h3>
              {g.hits.map((h) => {
                idx += 1;
                const i = idx;
                const t = h.matches?.find((m) => m.key === "title");
                const ex = excerpt(h);
                return (
                  <div
                    key={h.item.url + h.item.title}
                    id={`search-hit-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={i === active}
                    className={`search-hit${i === active ? " search-hit--active" : ""}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(h.item.url)}
                  >
                    <div className="search-hit__title">
                      <Highlight
                        text={h.item.title}
                        indices={t?.indices as [number, number][] | undefined}
                      />
                      {h.item.context && <small> · {h.item.context}</small>}
                    </div>
                    {ex && (
                      <div className="search-hit__excerpt">
                        <Highlight
                          text={ex.text}
                          indices={ex.indices as [number, number][]}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
        <div className="search-modal__foot">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> to navigate
          </span>
          <span>
            <kbd>↵</kbd> to open
          </span>
        </div>
      </div>
    </div>
  );
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <SearchCtx.Provider value={{ open }}>
      {children}
      {isOpen && <SearchModal onClose={() => setOpen(false)} />}
    </SearchCtx.Provider>
  );
}
