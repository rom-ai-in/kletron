import { NextApiRequest, NextApiResponse } from 'next'
import { requirePagesRouteAuth } from '@/src/lib/auth/apiAuth'
// Dummy apply – just acknowledge the diff.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requirePagesRouteAuth(req, res)
  if (!auth) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const runId = req.query.runId as string | undefined
  if (!runId) {
    return res.status(400).json({ error: 'Missing runId' })
  }

  const { diff } = req.body as { diff?: string }
  if (!diff) {
    return res.status(400).json({ error: 'Missing diff' })
  }

  // In a real implementation we would apply the diff to workspace.
  res.status(200).json({ status: 'applied', runId })
}
