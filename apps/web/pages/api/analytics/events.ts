// apps/web/pages/api/analytics/events.ts
import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    switch (req.method) {
        case 'POST':
            return handlePost(req, res);
        default:
            res.setHeader('Allow', ['POST']);
            res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

interface AnalyticsEvent {
    eventType: string;
    category?: string;
    previousCategory?: string;
    duration?: number;
    metadata?: Record<string, unknown>;
    timestamp?: number;
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { events }: { events: AnalyticsEvent[] } = req.body;

        if (!events || !Array.isArray(events) || events.length === 0) {
            return res.status(400).json({ error: 'Invalid events data' });
        }

        // In production, store events in database
        // For now, just acknowledge
        console.log('[Analytics] Received events:', events.length);

        events.forEach(event => {
            console.log(`[Analytics] ${event.eventType}`, {
                category: event.category,
                duration: event.duration,
                metadata: event.metadata
            });
        });

        return res.status(200).json({ success: true, received: events.length });
    } catch (error) {
        console.error('[Analytics] Error processing events:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
