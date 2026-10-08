import { createContext, useContext, useState, type ReactNode } from "react";
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
