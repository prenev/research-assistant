import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, post } from "./client";
import type {
  DocPage,
  Me,
  Page,
  PaperLite,
  ProteinLite,
  SidebarItem,
  SiteSettings,
  Stats,
} from "./types";

export const useSettings = () =>
  useQuery({
    queryKey: ["settings"],
    queryFn: () => api<SiteSettings>("/settings/"),
  });
export const useMe = () =>
  useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me/") });
export const useSidebar = (enabled = true) =>
  useQuery({
    queryKey: ["sidebar"],
    enabled,
    queryFn: () => api<SidebarItem[]>("/sidebar/"),
  });
export const useStats = () =>
  useQuery({ queryKey: ["stats"], queryFn: () => api<Stats>("/stats/") });
export const useDocPage = (slug?: string) =>
  useQuery({
    queryKey: ["doc", slug],
    enabled: !!slug,
    queryFn: async () => {
      const r = await api<Page<DocPage>>(
        `/doc-pages/?slug=${encodeURIComponent(slug!)}`,
      );
      if (!r.results[0]) throw new Error("not found");
      return r.results[0];
    },
  });
export const usePapers = () =>
  useQuery({
    queryKey: ["papers"],
    queryFn: () =>
      api<Page<PaperLite>>("/papers/?page_size=1000").then((r) => r.results),
  });
export const useProteins = () =>
  useQuery({
    queryKey: ["proteins"],
    queryFn: () =>
      api<Page<ProteinLite>>("/proteins/?page_size=1000").then(
        (r) => r.results,
      ),
  });

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { username: string; password: string }) =>
      post("/auth/login/", v),
    onSuccess: () => qc.invalidateQueries(),
  });
}
export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => post("/auth/logout/"),
    onSuccess: () => qc.invalidateQueries(),
  });
}
