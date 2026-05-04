
import { contextScanner } from './ContextScanner';
import { getWorkspaceByIdUnsafe, listAllWorkspaces } from '@kletron/server/services/workspaceService';
import { getContextGraphStore } from './contextGraphRegistry';

// Self-executing async function
(async () => {
    try {
        const targetWorkspaceId = process.env.KLETRON_WORKSPACE_ID;
        const workspace = targetWorkspaceId
            ? await getWorkspaceByIdUnsafe(targetWorkspaceId)
            : (await listAllWorkspaces())[0];
        if (!workspace || !workspace._id) {
            throw new Error("No active workspace configured.");
        }
        const root = workspace.rootPath;
        const store = getContextGraphStore(workspace._id.toString(), root);
        console.log(`[CLI] Triggering Context Scan for: ${root}`);
        await contextScanner.scanWorkspace(root, store);
        await store.save();
        console.log(`[CLI] Scan complete successfully.`);
        process.exit(0);
    } catch (e) {
        console.error(`[CLI] Scan failed:`, e);
        process.exit(1);
    }
})();
