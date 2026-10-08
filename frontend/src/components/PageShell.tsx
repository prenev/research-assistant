import type { ReactNode } from "react";
import { Layout } from "../theme/Layout";

export function PageShell({
  title,
  actions,
  children,
  narrow,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <Layout title={title}>
      <div
        className={`container margin-vert--lg${narrow ? " container--narrow" : ""}`}
      >
        <div className="page-header">
          <h1>{title}</h1>
          <div className="page-header__actions">{actions}</div>
        </div>
        {children}
      </div>
    </Layout>
  );
}
