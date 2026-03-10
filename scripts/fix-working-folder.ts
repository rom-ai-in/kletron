import { closeDb, getDb } from "../packages/server/src/lib/db";
import path from "node:path";
import fs from "node:fs";

async function main() {
  // Prefer an explicit CLI arg. When not provided, try to align the DB
  // workingFolder with the current MCP / UI config in config/config.json
  // so we don't accidentally point at an unrelated repository.
  let target = process.argv[2];

  if (!target) {
    try {
      const configDir = path.resolve(process.cwd(), "config");
      const configJsonPath = path.join(configDir, "config.json");
      if (fs.existsSync(configJsonPath)) {
        const raw = fs.readFileSync(configJsonPath, "utf-8");
        const data = JSON.parse(raw) as { workingFolder?: string };
        if (data.workingFolder && data.workingFolder.trim()) {
          target = data.workingFolder;
        }
      }
    } catch {
      // fall through to legacy default below
    }
  }

  if (!target) {
    // Legacy fallback – prefer not to use this in normal flows.
    target = "/home/romain/machine-trade";
  }
  const db = await getDb();
  const collection = db.collection("workspace_configs");
  const res = await collection.updateOne(
    {},
    { $set: { workingFolder: target, updatedAt: new Date() } },
    { upsert: true }
  );
  const cfg = await collection.findOne({});
  console.log(
    JSON.stringify(
      {
        matched: res.matchedCount,
        modified: res.modifiedCount,
        upserted: res.upsertedCount,
        workingFolder: cfg?.workingFolder ?? null,
      },
      null,
      2
    )
  );
  await closeDb();
}

main().catch(async (err) => {
  console.error("[fix-working-folder] failed:", (err as Error)?.message ?? err);
  await closeDb().catch(() => {});
  process.exit(1);
});
