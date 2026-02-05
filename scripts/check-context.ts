import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const requiredPaths = [
  "apps/web/app/app/config/context/page.tsx",
  "apps/web/app/app/context/page.tsx",
  "apps/web/app/api/context-config/route.ts",
  "apps/web/app/api/context/graph/route.ts",
  "packages/ui/src/components/config/ContextConfigView.tsx",
  "packages/ui/src/components/AuditContextForm.tsx",
];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const missing = requiredPaths.filter(
  (relativePath) => !fs.existsSync(path.join(root, relativePath)),
);

if (missing.length > 0) {
  console.error("Context regression check failed. Missing files:");
  for (const filePath of missing) {
    console.error(`- ${filePath}`);
  }
  process.exit(1);
}

console.log("Context regression check passed.");
