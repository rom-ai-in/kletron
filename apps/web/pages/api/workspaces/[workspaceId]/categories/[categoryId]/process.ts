// apps/web/pages/api/workspaces/[workspaceId]/categories/[categoryId]/process.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { workspaceCategoryService } from '@kletron/server/services/workspaceCategoryService';
import { categoryWorkflowRunner } from '@kletron/agent-core';
import { DEFAULT_WORK_CATEGORIES } from '@kletron/shared';
import { normalizeToWorkModeId } from '@kletron/shared/workMode';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { workspaceId, categoryId } = req.query;
    const { message } = req.body as { message: string };

    if (!workspaceId || !categoryId || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const mode = normalizeToWorkModeId(categoryId as string);
        const category = DEFAULT_WORK_CATEGORIES.find((c) => c.id === mode);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // Get workspace and category config
        const workspaceConfig = await workspaceCategoryService.getWorkspaceCategoryConfig(
            workspaceId as string,
            mode,
        );

        // Run workflow with category
        const result = await categoryWorkflowRunner.runWithCategory(
            message,
            category,
            workspaceId as string,
            {
                workspaceId: workspaceId as string,
                onUpdate: async (update) => {
                    // Stream updates back to client
                    res.write(`data: ${JSON.stringify(update)}\n\n`);
                }
            }
        );

        // Send final result
        res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`);
        res.end();

    } catch (error) {
        console.error('[ProcessAPI] Error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: (error as Error).message })}\n\n`);
        res.end();
    }
}
