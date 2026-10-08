export interface NavItem {
  label: string;
  to?: string;
  children?: { label: string; to: string }[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Docs", to: "/docs" },
  { label: "Papers", to: "/papers" },
  { label: "Proteins", to: "/proteins" },
  {
    label: "Visualise",
    children: [
      { label: "Evidence Matrix", to: "/visualise/evidence-matrix" },
      { label: "Gap Map", to: "/visualise/gap-map" },
      { label: "Network", to: "/visualise/network" },
      { label: "Timeline", to: "/visualise/timeline" },
      { label: "Evidence Chain", to: "/visualise/evidence-chain" },
    ],
  },
  { label: "Pipeline", to: "/pipeline" },
  { label: "Decisions", to: "/decisions" },
  { label: "Log", to: "/log" },
];
