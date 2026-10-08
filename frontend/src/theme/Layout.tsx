import { useEffect, type ReactNode } from "react";
import { useSettings } from "../api/hooks";
import { primaryCss } from "../lib/color";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";

export function Layout({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  const { data: s } = useSettings();
  useEffect(() => {
    if (!s) return;
    let el = document.getElementById("primary-palette");
    if (!el) {
      el = document.createElement("style");
      el.id = "primary-palette";
      document.head.appendChild(el);
    }
    el.textContent = primaryCss(s.primary_colour);
  }, [s?.primary_colour]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    document.title = [title, s?.site_title].filter(Boolean).join(" | ");
  }, [title, s?.site_title]);
  return (
    <div className="site">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <Navbar />
      <div id="main" className="main-wrapper" tabIndex={-1}>
        {children}
      </div>
      <Footer />
    </div>
  );
}
