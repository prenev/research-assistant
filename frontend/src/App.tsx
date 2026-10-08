import { Route, Routes } from "react-router-dom";
import { useMe } from "./api/hooks";
import { DocCategoryView, DocPageView, DocsIndex } from "./pages/DocPages";
import { Home } from "./pages/Home";
import { DecisionsPage } from "./pages/Decisions";
import { Login, NotFound, Placeholder } from "./pages/Misc";
import { PaperPage, PapersPage } from "./pages/Papers";
import { PipelinePage } from "./pages/Pipeline";
import { ProteinPage, ProteinsPage } from "./pages/Proteins";
import { SettingsPage } from "./pages/Settings";
import { TrashPage } from "./pages/Trash";

export function App() {
  const { data: me, isLoading } = useMe();
  if (isLoading) return null;
  // Reads need login unless the site is public; show the login form instead of 403 errors.
  if (me && !me.authenticated && !me.public_read) return <Login />;
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/docs" element={<DocsIndex />} />
      <Route path="/docs/category/:slug" element={<DocCategoryView />} />
      <Route path="/docs/:slug" element={<DocPageView />} />
      <Route path="/papers" element={<PapersPage />} />
      <Route path="/papers/:slug" element={<PaperPage />} />
      <Route path="/proteins" element={<ProteinsPage />} />
      <Route path="/proteins/:slug" element={<ProteinPage />} />
      <Route path="/decisions" element={<DecisionsPage />} />
      <Route path="/pipeline" element={<PipelinePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/trash" element={<TrashPage />} />
      <Route path="/log/*" element={<Placeholder title="Log" phase={4} />} />
      <Route
        path="/visualise/*"
        element={<Placeholder title="Visualise" phase={5} />}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
