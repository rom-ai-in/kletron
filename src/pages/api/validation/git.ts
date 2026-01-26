// src/pages/api/validation/git.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import simpleGit from 'simple-git';
import fs from 'fs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
        return;
    }

    const { path } = req.body;
    if (!path || typeof path !== 'string') {
        res.status(400).json({ valid: false, error: "Path is required" });
        return;
    }

    try {
        if (!fs.existsSync(path)) {
            res.status(400).json({ valid: false, error: "Directory does not exist" });
            return;
        }

        const git = simpleGit(path);
        const isRepo = await git.checkIsRepo();

        if (!isRepo) {
            res.status(200).json({ valid: false, error: "Not a git repository" });
            return;
        }

        const branchSummary = await git.branch();

        res.status(200).json({
            valid: true,
            currentBranch: branchSummary.current,
            branches: branchSummary.all,
        });

    } catch (error: any) {
        res.status(500).json({ valid: false, error: error.message || "Failed to validate git repository" });
    }
}
