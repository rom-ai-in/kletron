import { NextApiRequest, NextApiResponse } from 'next'
import { requirePagesRouteAuth } from '@/src/lib/auth/apiAuth'
// In a real implementation this would trigger the agent execution engine.
// For now we return a fake runId and status.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requirePagesRouteAuth(req, res)
  if (!auth) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { prompt, agentId } = req.body as { prompt?: string; agentId?: string }
  if (!prompt || !agentId) {
    return res.status(400).json({ error: 'Missing prompt or agentId' })
  }

  // Simulate run creation
  const runId = `run-${Date.now()}`
  res.status(200).json({ runId, status: 'queued' })
}
