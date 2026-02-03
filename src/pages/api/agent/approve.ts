
import type { NextApiRequest, NextApiResponse } from 'next';
import { ReActEngine } from '../../../services/agent/ReActEngine';
import { SafeEditGate } from '../../../services/agent/SafeEditGate';
import { requirePagesRouteAuth } from '@/src/lib/auth/apiAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const auth = await requirePagesRouteAuth(req, res);
    if (!auth) return;

    const engine = ReActEngine.getInstance();
    const gate = SafeEditGate.getInstance();

    if (req.method === 'POST') {
        const { editId, conversationId, action } = req.body;

        // Batch approval: approve all pending edits for a conversation
        if (conversationId && action === 'all') {
            try {
                const edits = gate.approveAll(conversationId);
                // Execute all approved edits
                const results = [];
                for (const edit of edits) {
                    try {
                        await engine.executeApprovedEdit(edit.id);
                        results.push({ id: edit.id, success: true });
                    } catch (e: any) {
                        results.push({ id: edit.id, success: false, error: e.message });
                    }
                }
                res.status(200).json({ success: true, approved: results.length, results });
                return;
            } catch (e: any) {
                res.status(500).json({ error: e.message });
                return;
            }
        }

        // Single edit approval
        if (!editId) {
            res.status(400).json({ error: 'Edit ID is required' });
            return;
        }

        try {
            await engine.executeApprovedEdit(editId);
            res.status(200).json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
        return;
    }

    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
}
