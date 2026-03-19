import { syncConfigJson } from "./packages/server/src/services/workspaceService";

async function run() {
    console.log("Forcing config.json sync from MongoDB workspaces...");
    await syncConfigJson();
    console.log("Done syncing.");
    process.exit(0);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
