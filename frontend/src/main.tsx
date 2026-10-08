import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "infima/dist/css/default/default.css";
import { api } from "./api/client";
import { App } from "./App";
import "./styles/custom.css";
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
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
