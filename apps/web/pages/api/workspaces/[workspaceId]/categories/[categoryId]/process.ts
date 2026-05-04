// apps/web/pages/api/workspaces/[workspaceId]/categories/[categoryId]/process.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { categoryWorkflowRunner } from '@kletron/agent-core/categoryWorkflowRunner';
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

        // Run workflow with category
        const result = await categoryWorkflowRunner.runWithCategory({
            userInput: message,
            category: mode,
            workspaceId: workspaceId as string,
            onProgress: (progressMsg) => {
                res.write(`data: ${JSON.stringify({ type: "progress", message: progressMsg })}\n\n`);
            },
        });

        // Send final result
        res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`);
        res.end();

    } catch (error) {
        console.error('[ProcessAPI] Error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: (error as Error).message })}\n\n`);
        res.end();
    }
}
