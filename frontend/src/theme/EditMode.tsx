import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useMe } from "../api/hooks";

const Ctx = createContext({ editing: false, toggle: () => {} });

export function EditModeProvider({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem("editMode") === "1";
    } catch {
      return false;
    }
  });
  // The editor is a big chunk. Fetch it quietly once you are logged in, so writing starts instantly.
  useEffect(() => {
    if (!me?.authenticated) return;
    const load = () => void import("../editor/RichEditor");
    const idle = (
      window as unknown as { requestIdleCallback?: (f: () => void) => number }
    ).requestIdleCallback;
    if (idle) idle(load);
    else setTimeout(load, 1500);
  }, [me?.authenticated]);

  const toggle = () =>
    setOn((v) => {
      try {
        localStorage.setItem("editMode", v ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !v;
    });
  return (
    <Ctx.Provider value={{ editing: on && !!me?.authenticated, toggle }}>
      {children}
    </Ctx.Provider>
  );
}
export const useEditMode = () => useContext(Ctx);
