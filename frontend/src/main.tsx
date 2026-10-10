import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "infima/dist/css/default/default.css";
import { api } from "./api/client";
import { App } from "./App";
import "./styles/custom.css";
import "./styles/viz.css";
import { FeedbackProvider } from "./components/Feedback";
import { SearchProvider } from "./components/Search";
import { FormHost } from "./forms/FormHost";
import { EditModeProvider } from "./theme/EditMode";
import { ThemeProvider } from "./theme/ThemeContext";

const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: false, refetchOnWindowFocus: true },
  },
});
api("/auth/csrf/").catch(() => {}); // sets the CSRF cookie for later writes

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <BrowserRouter>
          <FeedbackProvider>
            <EditModeProvider>
              <FormHost>
                <SearchProvider>
                  <App />
                </SearchProvider>
              </FormHost>
            </EditModeProvider>
          </FeedbackProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
