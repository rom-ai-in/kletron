export type BreadcrumbItem = {
  href: string;
  label: string;
  isCurrent: boolean;
};

type BreadcrumbResolver = (pathname: string) => BreadcrumbItem[] | null;

function titleCaseSegment(seg: string): string {
  if (!seg) return "";
  const cleaned = seg.replace(/[-_]+/g, " ").trim();
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(" ");
}

function splitPath(pathname: string): string[] {
  return pathname.split("?")[0].split("#")[0].split("/").filter(Boolean);
}

// function buildCrumbsFromSegments
function buildCrumbsFromSegments(pathname: string, segmentLabels: Record<string, string>): BreadcrumbItem[] {
  const segments = splitPath(pathname);
  const items: BreadcrumbItem[] = [];

  // Only show Explore if we are strictly at the root.
  // Otherwise, top-level items (Explore, Automations, etc.) are siblings in the sidebar.
  if (segments.length === 0) {
    items.push({ href: "/", label: "Explore", isCurrent: true });
  }

  let acc = "";
  for (let i = 0; i < segments.length; i++) {
    acc += `/${segments[i]}`;
    const isCurrent = i === segments.length - 1;
    const seg = segments[i];
    const label = segmentLabels[acc] ?? segmentLabels[seg] ?? titleCaseSegment(seg);
    items.push({ href: acc, label, isCurrent });
  }

  return items;
}

const resolverAutomationDetails: BreadcrumbResolver = (pathname) => {
  const m = pathname.match(/^\/app\/automations\/([^/]+)\/?$/);
  if (!m) return null;
  const id = m[1];
  const short = id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-3)}` : id;
  return [
    { href: "/app/automations", label: "Automations", isCurrent: false },
    { href: `/app/automations/${id}`, label: `Automation ${short}`, isCurrent: true },
  ];
};

const resolverRunDetails: BreadcrumbResolver = (pathname) => {
  const m = pathname.match(/^\/app\/runs\/([^/]+)\/?$/);
  if (!m) return null;
  const id = m[1];
  const short = id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-3)}` : id;
  return [
    { href: "/app/history", label: "Activity", isCurrent: false },
    { href: `/app/runs/${id}`, label: `Run ${short}`, isCurrent: true },
  ];
};

const resolverBAFeatureDetails: BreadcrumbResolver = (pathname) => {
  const m = pathname.match(/^\/app\/business-analyst\/features\/([^/]+)\/?$/);
  if (!m) return null;
  const id = m[1];
  const short = id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-3)}` : id;
  return [
    { href: "/app/business-analyst", label: "Business Analyst", isCurrent: false },
    { href: "/app/business-analyst/features", label: "Features", isCurrent: false },
    { href: `/app/business-analyst/features/${id}`, label: `Feature ${short}`, isCurrent: true },
  ];
};

const resolvers: BreadcrumbResolver[] = [resolverAutomationDetails, resolverRunDetails, resolverBAFeatureDetails];

const segmentLabels: Record<string, string> = {
  "/": "Explore",
  "/app": "App",
  "/app/explore": "Agent",
  "/app/deep-agent": "Agent",
  "/app/agent": "Agent",
  "/app/automations": "Automations",
  "/app/runs": "Execution Runs",
  "/app/vectors": "Vector Index",
  "/app/vectors/history": "Vector History",
  "/app/history": "Activity",
  "/app/changes": "Code Comparator",
  "/app/agent-graphs": "Agent Graphs",
  "/app/config": "Configuration",
  "/app/config/context": "Context",
  "/app/config/llm": "LLM",
  "/app/config/graphs": "Graphs",
  "/app/account": "Account",
  "/app/business-analyst": "Business Analyst",
  "/app/business-analyst/config": "BA Config",
  "/app/business-analyst/features": "Features",
  "/app/business-analyst/market": "Market Analysis",

  // Legacy mappings for breadcrumb segments
  "deep-agent": "Agent",
  "agent": "Agent",
  "automations": "Automations",
  "runs": "Execution Runs",
  "vectors": "Vector Index",
  "history": "Activity",
  "changes": "Code Comparator",
  "agent-graphs": "Agent Graphs",
  "config": "Configuration",
  "context": "Context",
  "llm": "LLM",
  "graphs": "Graphs",
  "account": "Account",
  "business-analyst": "Business Analyst",
  "features": "Features",
  "market": "Market Analysis",

};

export function getBreadcrumbItems(pathname: string): BreadcrumbItem[] {
  for (const r of resolvers) {
    const res = r(pathname);
    if (res) return res;
  }

  return buildCrumbsFromSegments(pathname, segmentLabels);
}
