import { NextApiRequest, NextApiResponse } from 'next'
// Dummy implementation – in production this would query a store.
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const runId = req.query.runId as string | undefined
  if (!runId) {
    return res.status(400).json({ error: 'Missing runId' })
  }

  // For demo, return a completed status after a short delay.
  const output = [
    { role: 'assistant', content: `Result for run ${runId}` },
  ]
  res.status(200).json({ status: 'completed', output })
}
