// src/pages/api/config.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getConfig, saveConfig } from '../../config';

// NOTE: Auth is intentionally disabled for this local dev-only endpoint.
// The workingFolder config is essential for the app to function.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {

    if (req.method === 'GET') {
        try {
            // Use getConfigSafe to avoid throwing errors when config is not set
            const { getConfigSafe } = await import('../../config');
            const cfg = await getConfigSafe();
            res.status(200).json(cfg || { workingFolder: "" });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
        return;
    }

    if (req.method === 'POST') {
        const body = req.body;
        // Accept workingFolder or legacy mcpDefaultDir
        const folderPath = body.workingFolder || body.mcpDefaultDir;
        if (!folderPath) {
            res.status(400).json({ error: '`workingFolder` is required' });
            return;
        }
        try {
            await saveConfig({ workingFolder: folderPath });

            // 1. Refresh the configuration cache
            const { refreshConfig } = await import('../../config');
            const updated = await refreshConfig();

            // 2. Reload McpClient (restarts transport and background services)
            const { McpClient } = await import('../../mcp/client');
            await McpClient.reloadInstance();

            res.status(200).json(updated);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
        return;
    }

    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
}
