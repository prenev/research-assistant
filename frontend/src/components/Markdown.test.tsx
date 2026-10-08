import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../theme/ThemeContext";
import { Markdown } from "./Markdown";

const papers = [
  {
    id: 1,
    slug: "malpetti-2025",
    title: "A paper",
    short_label: "Malpetti 2025",
    citation_number: 1,
    journal: "J",
    year: 2025,
    key_finding: "kf",
  },
];

beforeEach(() => {
  window.matchMedia =
    window.matchMedia ??
    ((() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    })) as never);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        String(url).includes("/papers/")
          ? { results: papers }
          : { results: [] },
    })),
  );
});

function renderMd(src: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider>
        <MemoryRouter>
          <Markdown source={src} />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("Markdown", () => {
  it("renders admonitions with default and custom titles", () => {
    renderMd(":::tip\nUse it.\n:::\n\n:::warning Careful\nBe careful.\n:::");
    expect(screen.getByText("TIP")).toBeInTheDocument();
    expect(screen.getByText("Careful")).toBeInTheDocument();
    expect(screen.getByText("Use it.")).toBeInTheDocument();
  });

  it("links citations to papers once loaded, and leaves unknown ones as text", async () => {
    renderMd("See {{cite:1}} and {{cite:9}}.");
    const link = await screen.findByRole("link", { name: "[1]" });
    expect(link).toHaveAttribute("href", "/papers/malpetti-2025");
    expect(screen.getByTitle("Paper not added yet")).toHaveTextContent("[9]");
  });

  it("adds heading anchors", () => {
    renderMd("## Hello world");
    expect(screen.getByRole("link", { name: /direct link/i })).toHaveAttribute(
      "href",
      "#hello-world",
    );
  });

  it("does not render raw HTML", () => {
    const { container } = renderMd("<script>window.x=1</script><b>bold</b>");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
  });

  it("renders code blocks with title and no embed expansion inside code", () => {
    renderMd('```js title="a.js"\nconst x = "{{cite:1}}";\n```');
    expect(screen.getByText("a.js")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy code/i }),
    ).toBeInTheDocument();
    expect(document.body.textContent).toContain("{{cite:1}}");
  });

  it("renders tabs and switches", async () => {
    renderMd(":::tabs\n::tab One\nfirst\n::tab Two\nsecond\n:::");
    expect(screen.getByText("first")).toBeInTheDocument();
    screen.getByRole("tab", { name: "Two" }).click();
    expect(await screen.findByText("second")).toBeInTheDocument();
  });
});
