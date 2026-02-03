import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { getConfig } from '@/src/config';
import { requirePagesRouteAuth } from '@/src/lib/auth/apiAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const auth = await requirePagesRouteAuth(req, res);
    if (!auth) return;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { path: dirPath } = req.body;

    if (!dirPath || typeof dirPath !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid path' });
    }

    // Security check: Enforce repo root
    const config = await getConfig();
    const repoRoot = config.workingFolder;

    // Resolve path relative to repo root if it's not absolute
    let fullPath = dirPath;
    if (!path.isAbsolute(dirPath)) {
        fullPath = path.resolve(repoRoot, dirPath);
    } else {
        fullPath = path.resolve(dirPath);
    }

    if (!fullPath.startsWith(repoRoot)) {
        return res.status(403).json({ error: 'Access denied: path outside of repository root' });
    }

    try {
        // Check if already exists
        if (fs.existsSync(fullPath)) {
            return res.status(409).json({ error: 'Directory already exists' });
        }

        fs.mkdirSync(fullPath, { recursive: true });
        res.status(200).json({ success: true, path: fullPath });
    } catch (error) {
        console.error('Error creating directory:', error);
        res.status(500).json({ error: 'Failed to create directory' });
    }
}
