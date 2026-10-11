import { Link } from "react-router-dom";
import { TYPE_LABEL, useBacklinks, type LinkItem } from "./data";

function Group({
  title,
  items,
  hint,
}: {
  title: string;
  items: (LinkItem & { snippet: string })[];
  hint?: string;
}) {
  if (!items.length) return null;
  return (
    <section className="backlinks__group" aria-label={title}>
      <h3>
        {title} <span className="table-sub">{items.length}</span>
      </h3>
      {hint && <p className="table-sub">{hint}</p>}
      <ul>
        {items.map((i) => (
          <li key={i.url}>
            <span className="badge badge--secondary">{TYPE_LABEL[i.type]}</span>{" "}
            <Link to={i.url}>{i.title}</Link>
            {i.snippet && <blockquote>{i.snippet}</blockquote>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Obsidian-style panel: what links here, what this links to, and unlinked mentions of its name. */
export function Backlinks({ url }: { url: string }) {
  const { data } = useBacklinks(url);
  const none =
    !data ||
    (!data.incoming.length && !data.outgoing.length && !data.mentions.length);
  return (
    <aside className="backlinks" aria-label="Connections">
      <h2>Connections</h2>
      {none ? (
        <p className="table-sub">
          Nothing links here yet. In any note, type <code>[[</code> followed by
          the name of a page, paper or protein to connect them.
        </p>
      ) : (
        <>
          <Group title="Linked from" items={data!.incoming} />
          <Group title="Links to" items={data!.outgoing} />
          <Group
            title="Mentioned without a link"
            items={data!.mentions}
            hint="These notes use this name in plain text. Wrap it in [[ ]] to connect them."
          />
        </>
      )}
    </aside>
  );
}
