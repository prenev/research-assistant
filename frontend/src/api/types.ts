export interface SiteSettings {
  site_title: string;
  tagline: string;
  research_question: string;
  logo: string | null;
  primary_colour: string;
  footer_text: string;
  public_read: boolean;
  min_event_count_warning: number;
}
export interface Me {
  authenticated: boolean;
  username?: string;
  public_read?: boolean;
}
export type SidebarItem = SidebarPage | SidebarCategory;
export interface SidebarPage {
  type: "page";
  id: number;
  slug: string;
  title: string;
  position: number;
}
export interface SidebarCategory {
  type: "category";
  id: number;
  slug: string;
  title: string;
  description: string;
  position: number;
  collapsed: boolean;
  items: SidebarItem[];
}
export interface DocPage {
  id: number;
  title: string;
  slug: string;
  category: number;
  category_slug: string;
  body: string;
  draft_body: string;
  has_draft: boolean;
  description: string;
  updated_at: string;
  last_edited_by_name: string | null;
}
export interface PaperLite {
  id: number;
  slug: string;
  title: string;
  short_label: string;
  citation_number: number | null;
  journal: string;
  year: number | null;
  key_finding: string;
}
export interface ProteinLite {
  id: number;
  slug: string;
  name: string;
  category: string;
  role: string;
}
export interface Stats {
  papers: number;
  proteins: number;
  pipeline_stages: number;
  pipeline_done: number;
  pipeline_progress_pct: number;
  recently_edited: {
    type: string;
    title: string;
    url: string;
    updated_at: string;
  }[];
}
interface Page<T> {
  results: T[];
}
export type { Page };
