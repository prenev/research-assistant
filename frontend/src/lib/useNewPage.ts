import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, post } from "../api/client";
import { refreshAfterWrite } from "../api/crud";
import { useFeedback } from "../components/Feedback";

interface Created {
  id: number;
  slug: string;
}

/**
 * "New page" works like Notion: it makes a blank page straight away and opens it in the editor with
 * the cursor in the title, instead of asking you to fill in a form first.
 */
export function useNewPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useFeedback();

  const run = async (
    path: string,
    listKey: unknown[],
    make: () => Promise<Created>,
  ) => {
    try {
      const created = await make();
      // wait only for the data the new page needs, refresh the rest in the background
      await qc.invalidateQueries({ queryKey: listKey });
      refreshAfterWrite(qc);
      navigate(`${path}/${created.slug}?edit=1`);
    } catch {
      toast("Could not create the page", "error");
    }
  };

  return {
    newDocPage: (categoryId?: number) =>
      run("/docs", ["sidebar"], async () => {
        let category = categoryId;
        if (!category) {
          const cats = await api<{
            results: { id: number; parent: number | null; position: number }[];
          }>("/doc-categories/?page_size=1000");
          const top = cats.results
            .filter((c) => c.parent === null)
            .sort((a, b) => a.position - b.position);
          category = (top[0] ?? cats.results[0])?.id;
        }
        if (!category) throw new Error("no category");
        return post<Created>("/doc-pages/", {
          title: "Untitled",
          category,
          body: "",
        });
      }),
    newLogPost: () =>
      run("/log", ["list", "log-posts"], () =>
        post<Created>("/log-posts/", { title: "Untitled", body: "" }),
      ),
  };
}
