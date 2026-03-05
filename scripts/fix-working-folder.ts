import { closeDb, getDb } from "../packages/server/src/lib/db";

async function main() {
  const target = process.argv[2] || "/home/romain/machine-trade";
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
