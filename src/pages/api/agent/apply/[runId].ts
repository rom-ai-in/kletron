import { NextApiRequest, NextApiResponse } from 'next'
// Dummy apply – just acknowledge the diff.
export default function handler(req: NextApiRequest, res: NextApiResponse) {
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
