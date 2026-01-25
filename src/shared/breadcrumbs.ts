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

function buildCrumbsFromSegments(pathname: string, segmentLabels: Record<string, string>): BreadcrumbItem[] {
  const segments = splitPath(pathname);
  const items: BreadcrumbItem[] = [];

  // Root
  items.push({ href: "/", label: "Workbench", isCurrent: segments.length === 0 });

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

const resolverCampaignDetails: BreadcrumbResolver = (pathname) => {
  const m = pathname.match(/^\/campaigns\/([^/]+)\/?$/);
  if (!m) return null;
  const id = m[1];
  const short = id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-3)}` : id;
  return [
    { href: "/", label: "Workbench", isCurrent: false },
    { href: "/campaigns", label: "Campaigns", isCurrent: false },
    { href: `/campaigns/${id}`, label: `Campaign ${short}`, isCurrent: true },
  ];
};

const resolverRunDetails: BreadcrumbResolver = (pathname) => {
  const m = pathname.match(/^\/runs\/([^/]+)\/?$/);
  if (!m) return null;
  const id = m[1];
  const short = id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-3)}` : id;
  return [
    { href: "/", label: "Workbench", isCurrent: false },
    { href: "/history", label: "Activity", isCurrent: false },
    { href: `/runs/${id}`, label: `Run ${short}`, isCurrent: true },
  ];
};

const resolvers: BreadcrumbResolver[] = [resolverCampaignDetails, resolverRunDetails];

const segmentLabels: Record<string, string> = {
  "/": "Workbench",
  "/campaigns": "Campaigns",
  "/runs": "Execution Runs",
  "/vectors": "Vector Index",
  "/vectors/history": "Vector History",
  "/history": "Activity",
  "/changes": "Changes",
  "/i18n": "Translation Agents",

  "/i18n/logs": "Translation Logs",
  "/config": "Configuration",
  "/config/context": "Context",
  "/config/llm": "LLM",
  "/config/graphs": "Graphs",
};

export function getBreadcrumbItems(pathname: string): BreadcrumbItem[] {
  for (const r of resolvers) {
    const res = r(pathname);
    if (res) return res;
  }

  return buildCrumbsFromSegments(pathname, segmentLabels);
}

