import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { getConfig } from '@/src/config';
import { getMimeType } from '@/src/utils/fileTypes';

/**
 * API endpoint to serve binary document files (pptx, docx, xlsx, pdf, etc.)
 * Unlike /api/fs/read which reads as UTF-8, this serves raw binary content
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

        // Read file as binary buffer
        const buffer = fs.readFileSync(fullPath);
        const mimeType = getMimeType(fullPath);
        const fileName = path.basename(fullPath);

        // Set appropriate headers for binary download/viewing
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);

        // Send buffer directly
        res.send(buffer);
    } catch (error) {
        console.error('Error reading document:', error);
        res.status(500).json({ error: 'Failed to read document' });
    }
}
