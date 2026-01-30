import { NextApiRequest, NextApiResponse } from 'next'
// Dummy diff generator – returns a simple hunk.
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const runId = req.query.runId as string | undefined
  if (!runId) {
    return res.status(400).json({ error: 'Missing runId' })
  }

  // Example diff – in real code this would come from agent output.
  const diffHunk = `@@ -1,3 +1,4 @@\n+Added line in run ${runId}`
  res.status(200).json({ diffHunk })
}
