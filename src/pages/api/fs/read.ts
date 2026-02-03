import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { getConfig } from '@/src/config';
import { requirePagesRouteAuth } from '@/src/lib/auth/apiAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const auth = await requirePagesRouteAuth(req, res);
    if (!auth) return;

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { path: filePath } = req.query;

    if (!filePath || typeof filePath !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid path' });
    }

    // Security check: Ensure we are only reading files within the allowed directories
    const config = await getConfig();
    const repoRoot = config.workingFolder;

    // Resolve path relative to repo root if it's not absolute, or just verify if it is
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
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const stats = fs.statSync(fullPath);
        if (!stats.isFile()) {
            return res.status(400).json({ error: 'Not a file' });
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        res.status(200).json({ content });
    } catch (error) {
        console.error('Error reading file:', error);
        res.status(500).json({ error: 'Failed to read file' });
    }
}
