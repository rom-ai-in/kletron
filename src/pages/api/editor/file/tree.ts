import { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs/promises'
import pathModule from 'path'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const queryPath = (req.query.path as string | undefined) ?? '.'
  try {
    const absPath = pathModule.resolve(process.cwd(), queryPath)
    const entries = await fs.readdir(absPath, { withFileTypes: true })
    const payload = entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
    }))
    res.status(200).json({ path: absPath, entries: payload })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
