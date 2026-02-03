import type { NextApiRequest, NextApiResponse } from 'next';
import { updateStore, editorStore } from '../../store';
import fs from 'fs';
import { AgentDiff } from '../../../../../types/editor';
import { requirePagesRouteAuth } from '@/src/lib/auth/apiAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const auth = await requirePagesRouteAuth(req, res);
    if (!auth) return;

    if (req.method !== 'POST') return res.status(405).end();

    const { agentId } = req.query;
    const { fileId, diffId } = req.body;

    if (!agentId || !fileId || !diffId) return res.status(400).json({ error: 'Missing parameters' });

    // In a real app, we would verify the diff exists and is pending/approved
    // and then apply the patch to the file system.
    // For now, we will just mark it as approved/committed and clear it from pending list?
    // Or actually strictly applying it to the file on disk.

    // 1. Find Diff
    const diffList = editorStore.pendingDiffs[fileId] || [];
    const diff = diffList.find(d => d.id === diffId);

    if (!diff) return res.status(404).json({ error: 'Diff not found' });

    try {
        // 2. Read File (assuming fileId is absolute path)
        const fileContent = fs.readFileSync(fileId, 'utf-8');
        const lines = fileContent.split('\n');

        // 3. Apply Chunks (naive implementation, assumes reverse order or non-overlapping)
        // Sort chunks descending by startLine to avoid offset issues
        const sortedChunks = [...diff.chunks].sort((a, b) => b.startLine - a.startLine);

        const newLines = [...lines];

        for (const chunk of sortedChunks) {
            // 1-based index to 0-based
            const startIdx = chunk.startLine - 1;
            const deleteCount = chunk.endLine - chunk.startLine + 1;

            // Insert new lines (if any)
            // ReplacementContent is array of strings
            const replacement = chunk.replacementContent || [];

            newLines.splice(startIdx, deleteCount, ...replacement);
        }

        // 4. Write back
        fs.writeFileSync(fileId, newLines.join('\n'), 'utf-8');

        // 5. Update Store: Remove this diff from pending
        updateStore((prev) => {
            const remaining = (prev.pendingDiffs[fileId] || []).filter(d => d.id !== diffId);
            return {
                ...prev,
                pendingDiffs: {
                    ...prev.pendingDiffs,
                    [fileId]: remaining
                }
            };
        });

        return res.status(200).json({ success: true });

    } catch (e: any) {
        console.error('Commit failed', e);
        return res.status(500).json({ error: e.message });
    }
}
