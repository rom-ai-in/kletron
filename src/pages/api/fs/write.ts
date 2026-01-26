import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

import { getConfig } from '@/src/config';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { path: filePath, content } = req.body;

    if (!filePath || typeof filePath !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid path' });
    }

    if (typeof content !== 'string') {
        return res.status(400).json({ error: 'Content must be a string' });
    }

    // Security check: Enforce repo root
    const config = await getConfig();
    const repoRoot = config.mcpDefaultDir;

    // Resolve path relative to repo root if it's not absolute
    let fullPath = filePath;
    if (!path.isAbsolute(filePath)) {
        fullPath = path.resolve(repoRoot, filePath);
    } else {
        fullPath = path.resolve(filePath);
    }

    if (!fullPath.startsWith(repoRoot)) {
        return res.status(403).json({ error: 'Access denied: path outside of repository root' });
    }

    try {
        // Ensure directory exists
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(fullPath, content, 'utf-8');
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error writing file:', error);
        res.status(500).json({ error: 'Failed to write file' });
    }
}
