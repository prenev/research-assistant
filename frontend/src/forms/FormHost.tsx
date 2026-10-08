import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { Obj } from "../api/crud";
import { ImportModal } from "./ImportModal";
import { FormModal } from "./FormModal";

interface OpenOpts {
  id?: number;
  initial?: Record<string, unknown>;
  onSaved?: (o: Obj) => void;
}
interface Ctx {
  openForm: (model: string, opts?: OpenOpts) => void;
  openImport: () => void;
}
const FormCtx = createContext<Ctx>({
  openForm: () => {},
  openImport: () => {},
});

export function FormHost({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<({ model: string } & OpenOpts) | null>(null);
  const [importing, setImporting] = useState(false);
  const openForm = useCallback(
    (model: string, opts: OpenOpts = {}) => setForm({ model, ...opts }),
    [],
  );
  const openImport = useCallback(() => setImporting(true), []);
  return (
    <FormCtx.Provider value={{ openForm, openImport }}>
      {children}
      {form && (
        <FormModal
          key={`${form.model}-${form.id ?? "new"}`}
          model={form.model}
          id={form.id}
          initial={form.initial}
          onSaved={form.onSaved}
          onClose={() => setForm(null)}
        />
      )}
      {importing && <ImportModal onClose={() => setImporting(false)} />}
    </FormCtx.Provider>
  );
}
export const useForms = () => useContext(FormCtx);
