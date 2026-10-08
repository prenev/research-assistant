import { Highlight, themes } from "prism-react-renderer";
import { useState } from "react";
import { useTheme } from "../theme/ThemeContext";
import { parseCodeMeta } from "../lib/markdown";

export function CodeBlock({
  code,
  language,
  meta,
}: {
  code: string;
  language: string;
  meta?: string;
}) {
  const { theme } = useTheme();
  const { title, highlight } = parseCodeMeta(meta);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="code-block">
      {title && <div className="code-block__title">{title}</div>}
      <div className="code-block__content">
        <Highlight
          code={code.replace(/\n$/, "")}
          language={language || "text"}
          theme={theme === "dark" ? themes.dracula : themes.github}
        >
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              tabIndex={0}
              className={`${className} code-block__pre`}
              style={style}
            >
              <code className="code-block__code">
                {tokens.map((line, i) => (
                  <span
                    key={i}
                    {...getLineProps({ line })}
                    className={`token-line${highlight.has(i + 1) ? " code-block__highlight" : ""}`}
                  >
                    {line.map((token, k) => (
                      <span key={k} {...getTokenProps({ token })} />
                    ))}
                  </span>
                ))}
              </code>
            </pre>
          )}
        </Highlight>
        <button
          type="button"
          className="clean-btn code-block__copy"
          onClick={copy}
          aria-label="Copy code to clipboard"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
