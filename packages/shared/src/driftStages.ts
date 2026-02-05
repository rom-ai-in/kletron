export type DriftStage = {
  id: string;
  name: string;
};

export const DEFAULT_DRIFT_STAGES: DriftStage[] = [
  { id: "security", name: "Security" },
  { id: "architecture", name: "Architecture" },
  { id: "performance", name: "Performance" },
  { id: "reliability", name: "Reliability" },
  { id: "ux", name: "UX" },
  { id: "accessibility", name: "Accessibility" },
  { id: "api", name: "API Design" },
  { id: "data", name: "Data Integrity" },
  { id: "observability", name: "Observability" },
  { id: "maintainability", name: "Maintainability" },
  { id: "testing", name: "Testing" },
  { id: "documentation", name: "Documentation" },
  { id: "dependency", name: "Dependencies" },
  { id: "build", name: "Build & Tooling" },
  { id: "refactor", name: "Refactors" },
  { id: "conventions", name: "Conventions" },
];
