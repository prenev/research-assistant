import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Modal } from "./Modal";

type ToastKind = "success" | "error";
interface Ctx {
  toast: (message: string, kind?: ToastKind) => void;
  confirm: (
    message: string,
    opts?: { confirmLabel?: string; danger?: boolean },
  ) => Promise<boolean>;
}
const FeedbackCtx = createContext<Ctx>({
  toast: () => {},
  confirm: async () => false,
});

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<
    { id: number; message: string; kind: ToastKind }[]
  >([]);
  const [ask, setAsk] = useState<{
    message: string;
    confirmLabel: string;
    danger: boolean;
  } | null>(null);
  const resolver = useRef<(v: boolean) => void>();
  const nextId = useRef(1);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  const confirm = useCallback<Ctx["confirm"]>(
    (message, opts) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setAsk({
          message,
          confirmLabel: opts?.confirmLabel ?? "Delete",
          danger: opts?.danger ?? true,
        });
      }),
    [],
  );
  const answer = (v: boolean) => {
    resolver.current?.(v);
    setAsk(null);
  };
  return (
    <FeedbackCtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`alert alert--${t.kind === "error" ? "danger" : "success"} toast`}
          >
            {t.message}
          </div>
        ))}
      </div>
      {ask && (
        <Modal
          title="Please confirm"
          onClose={() => answer(false)}
          footer={
            <>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => answer(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                data-autofocus
                className={`button ${ask.danger ? "button--danger" : "button--primary"}`}
                onClick={() => answer(true)}
              >
                {ask.confirmLabel}
              </button>
            </>
          }
        >
          <p>{ask.message}</p>
        </Modal>
      )}
    </FeedbackCtx.Provider>
  );
}
export const useFeedback = () => useContext(FeedbackCtx);
