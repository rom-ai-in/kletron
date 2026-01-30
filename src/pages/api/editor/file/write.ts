import { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs/promises'
import pathModule from 'path'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { path, content } = req.body as { path: string; content: string }
  if (!path || typeof content !== 'string') {
    return res.status(400).json({ error: 'Missing path or content' })
  }

  try {
    const absPath = pathModule.resolve(process.cwd(), path)
    await fs.writeFile(absPath, content, 'utf8')
    res.status(200).json({ ok: true, path: absPath })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
