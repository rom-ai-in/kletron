import type { NextApiRequest, NextApiResponse } from 'next';
import { updateStore, editorStore } from '../../store';
import { randomUUID } from 'crypto';
import { AgentDiff } from '../../../../../types/editor';
import { requirePagesRouteAuth } from '@/src/lib/auth/apiAuth';

function checkConflict(newDiff: AgentDiff, existingDiffs: AgentDiff[]): boolean {
    // Simple line overlap check
    for (const d of existingDiffs) {
        if (d.status === 'rejected') continue;
        for (const chunkA of newDiff.chunks) {
            for (const chunkB of d.chunks) {
                // Check if range [startLine, endLine] overlaps
                if (Math.max(chunkA.startLine, chunkB.startLine) <= Math.min(chunkA.endLine, chunkB.endLine)) {
                    return true;
                }
            }
        }
    }
    return false;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const auth = await requirePagesRouteAuth(req, res);
    if (!auth) return;

    if (req.method !== 'POST') return res.status(405).end();

    const { agentId } = req.query;
    const { fileId, chunks } = req.body;

    if (!agentId || !fileId || !chunks) return res.status(400).json({ error: 'Missing parameters' });

    const newDiff: AgentDiff = {
        id: randomUUID(),
        agentId: agentId as string,
        fileId,
        chunks,
        timestamp: Date.now(),
        status: 'pending'
    };

    let conflictDetected = false;

    updateStore((prev) => {
        const existing = prev.pendingDiffs[fileId] || [];
        conflictDetected = checkConflict(newDiff, existing);

        if (conflictDetected) {
            newDiff.status = 'conflict';
            // We still store it, but flagged as conflict
        }

        return {
            ...prev,
            pendingDiffs: {
                ...prev.pendingDiffs,
                [fileId]: [...existing, newDiff]
            }
        };
    });

    return res.status(200).json({ success: true, diffId: newDiff.id, conflict: conflictDetected });
}
