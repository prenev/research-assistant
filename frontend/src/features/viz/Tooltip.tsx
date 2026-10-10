import { useCallback, useState, type ReactNode } from "react";

/** Follows the pointer. Content is also reachable without a mouse (detail panel and table view). */
export function useTooltip() {
  const [tip, setTip] = useState<{
    x: number;
    y: number;
    content: ReactNode;
  } | null>(null);
  const show = useCallback(
    (e: { clientX: number; clientY: number }, content: ReactNode) => {
      setTip({ x: e.clientX, y: e.clientY, content });
    },
    [],
  );
  const hide = useCallback(() => setTip(null), []);
  const node = tip && (
    <div
      className="viz-tooltip"
      role="tooltip"
      style={{
        left: Math.min(tip.x + 14, window.innerWidth - 300),
        top: tip.y + 14,
      }}
    >
      {tip.content}
    </div>
  );
  return { show, hide, node };
}
