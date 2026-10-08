import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

const ICONS: Record<string, string> = {
  note: "M6.3 5.69a.942.942 0 0 1-.28-.7c0-.28.09-.52.28-.7.19-.18.42-.28.7-.28.28 0 .52.09.7.28.18.19.28.42.28.7 0 .28-.09.52-.28.7a1 1 0 0 1-.7.3c-.28 0-.52-.11-.7-.3zM8 7.99c-.02-.25-.11-.48-.31-.69-.2-.19-.42-.3-.69-.31H6c-.27.02-.48.13-.69.31-.2.2-.3.44-.31.69h1v3c.02.27.11.5.31.69.2.2.42.31.69.31h1c.27 0 .48-.11.69-.31.2-.19.3-.42.31-.69H8V7.98v.01zM7 2.3c-3.14 0-5.7 2.54-5.7 5.68 0 3.14 2.56 5.7 5.7 5.7s5.7-2.55 5.7-5.7c0-3.15-2.56-5.69-5.7-5.69v.01z",
  info: "M7 2.3c3.14 0 5.7 2.56 5.7 5.7s-2.56 5.7-5.7 5.7A5.71 5.71 0 0 1 1.3 8c0-3.14 2.56-5.7 5.7-5.7zM7 1C3.14 1 0 4.14 0 8s3.14 7 7 7 7-3.14 7-7-3.14-7-7-7zm1 3H6v5h2V4zm0 6H6v2h2v-2z",
  tip: "M7.5 0C5.49 0 2 1.5 2 5.5c0 1.88.88 3.14 1.62 3.9.4.4.88.97.88 1.6V12h6v-1c0-.63.48-1.2.88-1.6C12.12 8.64 13 7.38 13 5.5 13 1.5 9.51 0 7.5 0zM5 13v1c0 .55.45 1 1 1h3c.55 0 1-.45 1-1v-1H5z",
  warning:
    "M8.893 1.5c-.183-.31-.52-.5-.887-.5s-.703.19-.886.5L.138 13.499a.98.98 0 0 0 0 1.001c.193.31.53.501.886.501h13.964c.367 0 .704-.19.877-.5a1.03 1.03 0 0 0 .01-1.002L8.893 1.5zm.133 11.497H6.987v-2.003h2.039v2.003zm0-3.004H6.987V5.987h2.039v4.006z",
  danger:
    "M5.05.31c.81 2.17.41 3.38-.52 4.31C3.55 5.67 1.98 6.45.9 7.98c-1.45 2.05-1.7 6.53 3.53 7.7-2.2-1.16-2.67-4.52-.3-6.61-.61 2.03.53 3.33 1.94 2.86 1.39-.47 2.3.53 2.27 1.67-.02.78-.31 1.44-1.13 1.81 3.42-.59 4.78-3.42 4.78-5.56 0-2.84-2.53-3.22-1.25-5.61-1.52.13-2.03 1.13-1.89 2.75.09 1.08-1.02 1.8-1.86 1.33-.67-.41-.66-1.19-.06-1.78C8.18 5.31 8.68 2.45 5.05.32L5.03.3l.02.01z",
};

export function Admonition({
  kind,
  title,
  children,
}: {
  kind: string;
  title: string;
  children: ReactNode;
}) {
  const alert =
    {
      note: "secondary",
      tip: "success",
      info: "info",
      warning: "warning",
      danger: "danger",
    }[kind] ?? "secondary";
  return (
    <div className={`admonition alert alert--${alert}`} role="note">
      <div className="admonition__heading">
        <span className="admonition__icon">
          <svg viewBox="0 0 14 16" width="14" height="16" aria-hidden="true">
            <path fillRule="evenodd" d={ICONS[kind] ?? ICONS.note} />
          </svg>
        </span>
        {title}
      </div>
      <div className="admonition__content">{children}</div>
    </div>
  );
}

export function Details({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="alert alert--info details-block">
      <summary>{title}</summary>
      <div className="details-block__content">{children}</div>
    </details>
  );
}

export function Tabs({ tabs }: { tabs: { label: string; node: ReactNode }[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const next =
      e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const n = (next + tabs.length) % tabs.length;
    setActive(n);
    refs.current[n]?.focus();
  };
  return (
    <div className="tabs-container">
      <ul role="tablist" aria-orientation="horizontal" className="tabs">
        {tabs.map((t, i) => (
          <li
            key={t.label}
            role="tab"
            tabIndex={active === i ? 0 : -1}
            aria-selected={active === i}
            ref={(el) => (refs.current[i] = el)}
            className={`tabs__item${active === i ? " tabs__item--active" : ""}`}
            onClick={() => setActive(i)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
          </li>
        ))}
      </ul>
      <div className="margin-top--md" role="tabpanel">
        {tabs[active]?.node}
      </div>
    </div>
  );
}
