import { NextApiRequest, NextApiResponse } from 'next'
import { requirePagesRouteAuth } from '@/src/lib/auth/apiAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requirePagesRouteAuth(req, res)
  if (!auth) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  res.status(200).json({ ok: true })
}
