import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";

export const useViz = <T>(name: string, query = "") =>
  useQuery({
    queryKey: ["viz", name, query],
    queryFn: () => api<T>(`/viz/${name}/${query ? `?${query}` : ""}`),
  });

export interface PaperBrief {
  id: number;
  slug: string;
  label: string;
  title: string;
  citation_number: number | null;
  year: number | null;
}
export interface MatrixData {
  proteins: {
    id: number;
    slug: string;
    name: string;
    category: string;
    role: string;
    findings: number;
    papers: number;
    top_direction: string | null;
    agreement: number | null;
  }[];
  papers: PaperBrief[];
  cells: {
    id: number;
    protein: number;
    paper: number;
    direction: string;
    context: string;
    context_detail: string;
    effect: string;
    subgroup: string;
    fluid: string;
  }[];
}
export interface GapData {
  rows: string[];
  columns: string[];
  mode: "papers" | "findings";
  protein: string;
  cells: {
    population: string;
    column: string;
    papers: PaperBrief[];
    count: number;
    is_target: boolean;
  }[];
  unplaced: PaperBrief[];
}
export interface NetworkData {
  nodes: {
    id: string;
    type: "protein" | "paper";
    label: string;
    slug: string;
    degree: number;
    role?: string;
    year?: number;
  }[];
  edges: { source: string; target: string; direction: string; count: number }[];
}
export interface TimelineData {
  papers: (PaperBrief & {
    sample_size: number | null;
    design: string;
    population: string;
  })[];
  undated: PaperBrief[];
  per_year: { year: number; count: number }[];
}
export interface ChainData {
  requirements: {
    id: number;
    number: number;
    title: string;
    description: string;
  }[];
  papers: (PaperBrief & {
    assessments: Record<
      number,
      { id: number; met: "yes" | "partial" | "no"; justification: string }
    >;
  })[];
  totals: {
    requirement: number;
    yes: number;
    partial: number;
    no: number;
    unset: number;
  }[];
  meets_all: PaperBrief[];
  any_meets_all: boolean;
}
export interface DashboardData {
  today: string;
  activity: { date: string; count: number }[];
  streak: { current: number; longest: number; at_risk: boolean };
  week: { start: string; goal: number; finished: number; edits: number };
  reading: { to_read: number; reading: number; read: number; total: number };
  evidence: {
    findings: number;
    proteins: number;
    proteins_with_findings: number;
  };
  next_actions: { kind: string; title: string; detail: string; url: string }[];
  milestones: {
    key: string;
    label: string;
    current: number;
    target: number;
    done: boolean;
  }[];
}
