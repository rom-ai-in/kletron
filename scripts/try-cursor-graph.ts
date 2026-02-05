import * as workflows from "../packages/agent-core/src/workflows";
import * as db from "../packages/server/src/lib/db";

const graphId = process.argv[2] ?? "697f020b8ad573578a4962f3";
const mission =
  process.argv.slice(3).join(" ") ||
  "Analyze the auth logic in the app and report whether it is solid, with any concerns.";

async function main() {
  const runWorkflow =
    (workflows as any).runWorkflow ?? (workflows as any).default?.runWorkflow;
  if (!runWorkflow) {
    throw new Error("runWorkflow export not found in agent-core workflows module.");
  }
  const result = await runWorkflow(mission, graphId);
  // Print a compact summary so we can inspect quickly.
  const report = typeof result.outputs?.report === "string" ? result.outputs.report : "";
  console.log(
    JSON.stringify(
      {
        graphId,
        mission,
        conclusion: result.conclusion,
        reportPreview: report.slice(0, 2000),
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error("Graph run failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    const closeFn = (db as any).closeDb ?? (db as any).closeMongoConnection;
    if (closeFn) {
      await closeFn().catch(() => undefined);
    }
  });
