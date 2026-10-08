import { Route, Routes } from "react-router-dom";
import { useMe } from "./api/hooks";
import { DocCategoryView, DocPageView, DocsIndex } from "./pages/DocPages";
import { Home } from "./pages/Home";
import { Login, NotFound, Placeholder } from "./pages/Misc";

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
      <Route
        path="/papers/*"
        element={<Placeholder title="Papers" phase={4} />}
      />
      <Route
        path="/proteins/*"
        element={<Placeholder title="Proteins" phase={4} />}
      />
      <Route path="/log/*" element={<Placeholder title="Log" phase={4} />} />
      <Route
        path="/visualise/*"
        element={<Placeholder title="Visualise" phase={5} />}
      />
      <Route
        path="/pipeline"
        element={<Placeholder title="Pipeline" phase={5} />}
      />
      <Route
        path="/decisions"
        element={<Placeholder title="Decisions" phase={4} />}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
