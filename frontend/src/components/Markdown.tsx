import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { Link } from "react-router-dom";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { parseBlocks, transformEmbeds } from "../lib/markdown";
import { Admonition, Details, Tabs } from "./Blocks";
import { CodeBlock } from "./CodeBlock";
import { Embed } from "./Embeds";

function heading(Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") {
  return function Heading({
    id,
    children,
  }: {
    id?: string;
    children?: ReactNode;
  }) {
    return (
      <Tag id={id} className="anchor">
        {children}
        {id && (
          <a
            className="hash-link"
            href={`#${id}`}
            aria-label={`Direct link to heading`}
            title="Direct link to heading"
          >
            #
          </a>
        )}
      </Tag>
    );
  };
}

const components: Components = {
  h1: heading("h1"),
  h2: heading("h2"),
  h3: heading("h3"),
  h4: heading("h4"),
  h5: heading("h5"),
  h6: heading("h6"),
  a({ href = "", children }) {
    const m = href.match(/^#embed:(\w+):(.*)$/);
    if (m) return <Embed kind={m[1]} arg={decodeURIComponent(m[2])} />;
    if (href.startsWith("/")) return <Link to={href}>{children}</Link>;
    if (href.startsWith("#")) return <a href={href}>{children}</a>;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="table-wrap">
        <table>{children}</table>
      </div>
    );
  },
  pre({ children, node }) {
    const child = Children.toArray(children)[0];
    if (!isValidElement(child)) return <pre>{children}</pre>;
    const el = child as ReactElement<{
      className?: string;
      children?: ReactNode;
    }>;
    const lang = /language-(\S+)/.exec(el.props.className ?? "")?.[1] ?? "";
    const first = node?.children?.[0] as
      { data?: { meta?: string } } | undefined;
    return (
      <CodeBlock
        code={String(el.props.children ?? "")}
        language={lang}
        meta={first?.data?.meta}
      />
    );
  },
  input({ type, checked }) {
    return type === "checkbox" ? (
      <input type="checkbox" checked={checked} disabled readOnly />
    ) : null;
  },
};

function Inline({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSlug]}
      components={components}
      urlTransform={(u) => u}
      skipHtml
    >
      {transformEmbeds(text)}
    </ReactMarkdown>
  );
}

/** Renders Docusaurus-flavoured markdown. Raw HTML is never rendered. */
export function Markdown({ source }: { source: string }) {
  return (
    <div className="markdown">
      {parseBlocks(source).map((b, i) => {
        switch (b.type) {
          case "md":
            return <Inline key={i} text={b.text} />;
          case "admonition":
            return (
              <Admonition key={i} kind={b.kind} title={b.title}>
                <Markdown source={b.body} />
              </Admonition>
            );
          case "details":
            return (
              <Details key={i} title={b.title}>
                <Markdown source={b.body} />
              </Details>
            );
          case "tabs":
            return (
              <Tabs
                key={i}
                tabs={b.tabs.map((t) => ({
                  label: t.label,
                  node: <Markdown source={t.body} />,
                }))}
              />
            );
        }
      })}
    </div>
  );
}
