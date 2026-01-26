
import type { NextApiRequest, NextApiResponse } from 'next';
import { ReActEngine } from '../../../services/agent/ReActEngine';
import { SafeEditGate } from '../../../services/agent/SafeEditGate';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const engine = ReActEngine.getInstance();

    if (req.method === 'POST') {
        const { editId } = req.body;
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
