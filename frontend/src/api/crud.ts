import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { api, post } from "./client";
import type { Page } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Obj = Record<string, any> & { id: number };

/**
 * After any write, refresh what is on screen, in the background. It deliberately does not wait for
 * the refresh (so a save reports success straight away) and leaves slow, rarely-changing data such
 * as Wikipedia background alone.
 */
export function refreshAfterWrite(qc: QueryClient) {
  void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "wiki" });
}

const qs = (params?: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {}))
    if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const useList = <T extends Obj = Obj>(
  endpoint: string,
  params?: Record<string, string | number | undefined>,
) =>
  useQuery({
    queryKey: ["list", endpoint, params ?? {}],
    queryFn: () =>
      api<Page<T>>(`/${endpoint}/${qs({ page_size: 1000, ...params })}`).then(
        (r) => r.results,
      ),
  });

export const useOne = <T extends Obj = Obj>(
  endpoint: string,
  id?: number | string,
) =>
  useQuery({
    queryKey: ["one", endpoint, id],
    enabled: id !== undefined,
    queryFn: () => api<T>(`/${endpoint}/${id}/`),
  });

/** Every write invalidates all cached reads so lists, charts and counts update without a reload. */
export function useSaveMutation(endpoint: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: unknown }) =>
      id
        ? api<Obj>(`/${endpoint}/${id}/`, {
            method: "PATCH",
            body: JSON.stringify(data),
          })
        : post<Obj>(`/${endpoint}/`, data),
    onSuccess: () => refreshAfterWrite(qc),
  });
}

export function useDeleteMutation(endpoint: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api<void>(`/${endpoint}/${id}/`, { method: "DELETE" }),
    onSuccess: () => refreshAfterWrite(qc),
  });
}

export function useFormMeta(endpoint: string) {
  return useQuery({
    queryKey: ["meta", endpoint],
    staleTime: Infinity,
    queryFn: async () => {
      const r = await api<{ fields: Record<string, FieldMeta> }>(
        `/form-meta/${endpoint}/`,
      );
      return r.fields;
    },
  });
}

export interface FieldMeta {
  type: string;
  required: boolean;
  read_only: boolean;
  label: string;
  help_text?: string;
  max_length?: number;
  choices?: { value: string; display_name: string }[];
}

export interface HistoryEntry {
  history_id: number;
  history_date: string;
  history_type: "+" | "~" | "-";
  user: string | null;
  changes: { field: string; old: unknown; new: unknown }[];
}
export const useHistory = (endpoint: string, id: number) =>
  useQuery({
    queryKey: ["history", endpoint, id],
    queryFn: () => api<HistoryEntry[]>(`/${endpoint}/${id}/history/`),
  });

export function useRestore(endpoint: string, id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (historyId: number) =>
      post<Obj>(`/${endpoint}/${id}/restore/${historyId}/`),
    onSuccess: () => refreshAfterWrite(qc),
  });
}

/** The readable label for an enum value, using the API's own choice list (falls back to the raw value). */
export function choiceLabel(
  meta: Record<string, FieldMeta> | undefined,
  field: string,
  value: string | null | undefined,
): string {
  if (!value) return "";
  return (
    meta?.[field]?.choices?.find((c) => c.value === value)?.display_name ??
    value.replace(/_/g, " ")
  );
}
