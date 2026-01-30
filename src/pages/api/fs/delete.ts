import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { getConfig } from '@/src/config';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'DELETE' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { path: targetPath } = req.body;

    if (!targetPath || typeof targetPath !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid path' });
    }

    // Security check: Enforce repo root
    const config = await getConfig();
    const repoRoot = config.workingFolder;

    // Resolve path relative to repo root if it's not absolute
    let fullPath = targetPath;
    if (!path.isAbsolute(targetPath)) {
        fullPath = path.resolve(repoRoot, targetPath);
    } else {
        fullPath = path.resolve(targetPath);
    }

    if (!fullPath.startsWith(repoRoot)) {
        return res.status(403).json({ error: 'Access denied: path outside of repository root' });
    }

    // Prevent deleting the repo root itself
    if (fullPath === repoRoot) {
        return res.status(403).json({ error: 'Cannot delete the working folder root' });
    }

    try {
        // Check if exists
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'Path not found' });
        }

        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(fullPath);
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error deleting path:', error);
        res.status(500).json({ error: 'Failed to delete' });
    }
}
