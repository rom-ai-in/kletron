
import type { NextApiRequest, NextApiResponse } from 'next';
import { ConversationService } from '../../../services/agent/ConversationService';
import { getChatModel } from '../../../llm';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { requirePagesRouteAuth } from '@/src/lib/auth/apiAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const auth = await requirePagesRouteAuth(req, res);
    if (!auth) return;

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
        return;
    }

    const service = new ConversationService();
    const { conversationId, userMessage } = req.body;

    if (!conversationId || typeof conversationId !== 'string') {
        res.status(400).json({ error: 'Missing conversationId' });
        return;
    }

    if (!userMessage || typeof userMessage !== 'string') {
        res.status(400).json({ error: 'Missing userMessage' });
        return;
    }

    try {
        // Get the conversation
        const conversation = await service.get(conversationId);
        if (!conversation) {
            res.status(404).json({ error: 'Conversation not found' });
            return;
        }

        // Generate title using LLM
        const llm = await getChatModel(undefined, { temperature: 0.7 });

        const systemPrompt = `You are a helpful assistant that generates very short, concise chat titles.
Given the user's message, generate a title that is:
- Maximum 4-5 words
- Descriptive of the topic
- No quotes, no punctuation at the end
- Professional and clear

Respond with ONLY the title, nothing else.`;

        const response = await llm.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(`User message: "${userMessage.substring(0, 500)}"`)
        ]);

        const generatedTitle = (response.content as string).trim().replace(/^["']|["']$/g, '');

        // Update the conversation title
        await service.updateTitle(conversationId, generatedTitle);

        res.status(200).json({ success: true, title: generatedTitle });
    } catch (e: any) {
        console.error('[API /api/agent/generate-title POST] Error:', e);
        res.status(500).json({ error: 'Failed to generate title' });
    }
}
