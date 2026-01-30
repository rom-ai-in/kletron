import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { getConfig } from '@/src/config';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { oldPath, newPath } = req.body;

    if (!oldPath || typeof oldPath !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid oldPath' });
    }

    if (!newPath || typeof newPath !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid newPath' });
    }

    // Security check: Enforce repo root
    const config = await getConfig();
    const repoRoot = config.workingFolder;

    // Resolve paths
    const resolvedOldPath = path.isAbsolute(oldPath)
        ? path.resolve(oldPath)
        : path.resolve(repoRoot, oldPath);

    const resolvedNewPath = path.isAbsolute(newPath)
        ? path.resolve(newPath)
        : path.resolve(repoRoot, newPath);

    if (!resolvedOldPath.startsWith(repoRoot)) {
        return res.status(403).json({ error: 'Access denied: oldPath outside of repository root' });
    }

    if (!resolvedNewPath.startsWith(repoRoot)) {
        return res.status(403).json({ error: 'Access denied: newPath outside of repository root' });
    }

    try {
        // Check if source exists
        if (!fs.existsSync(resolvedOldPath)) {
            return res.status(404).json({ error: 'Source path not found' });
        }

        // Check if target already exists
        if (fs.existsSync(resolvedNewPath)) {
            return res.status(409).json({ error: 'Target path already exists' });
        }

        fs.renameSync(resolvedOldPath, resolvedNewPath);
        res.status(200).json({ success: true, newPath: resolvedNewPath });
    } catch (error) {
        console.error('Error renaming path:', error);
        res.status(500).json({ error: 'Failed to rename' });
    }
}
