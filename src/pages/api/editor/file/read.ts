import { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs/promises'
import pathModule from 'path'
import { requirePagesRouteAuth } from '@/src/lib/auth/apiAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requirePagesRouteAuth(req, res)
  if (!auth) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { path } = req.body as { path: string }
  if (!path) {
    return res.status(400).json({ error: 'Missing path' })
  }

  try {
    const absPath = pathModule.resolve(process.cwd(), path)
    const content = await fs.readFile(absPath, 'utf8')
    res.status(200).json({ content, path: absPath })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
