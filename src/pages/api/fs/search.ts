import { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import { getConfig } from '@/src/config';
import { requirePagesRouteAuth } from '@/src/lib/auth/apiAuth';

const execPromise = util.promisify(exec);

export type SearchResult = {
    file: string;
    line?: number;
    text?: string;
    matchType: 'file' | 'content';
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const auth = await requirePagesRouteAuth(req, res);
    if (!auth) return;

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { q, type } = req.query;
    const query = Array.isArray(q) ? q[0] : q;
    const searchType = type === 'content' ? 'content' : 'file';

    if (!query || query.length < 2) {
        return res.status(400).json({ error: 'Query too short' });
    }

    // Determine root directory from config
    const config = await getConfig();
    const rootDir = config.workingFolder;

    try {
        let results: SearchResult[] = [];

        if (searchType === 'file') {
            // Use find for file search
            const findCmd = `find . -type f -not -path '*/.*' -not -path '*/node_modules/*' -iname '*${query}*' | head -n 100`;

            const { stdout } = await execPromise(findCmd, { cwd: rootDir, maxBuffer: 1024 * 1024 });

            results = stdout
                .split('\n')
                .filter(Boolean)
                .map(line => ({
                    file: line.startsWith('./') ? line.substring(2) : line,
                    matchType: 'file' as const
                }));

        } else {
            // Use grep for content search
            const grepCmd = `grep -rniI --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next "${query}" . | head -n 100`;

            const { stdout } = await execPromise(grepCmd, { cwd: rootDir, maxBuffer: 1024 * 1024 });

            results = stdout
                .split('\n')
                .filter(Boolean)
                .map(line => {
                    const firstColon = line.indexOf(':');
                    const secondColon = line.indexOf(':', firstColon + 1);

                    if (firstColon === -1 || secondColon === -1) return null;

                    const file = line.substring(0, firstColon);
                    const lineNum = parseInt(line.substring(firstColon + 1, secondColon), 10);
                    const text = line.substring(secondColon + 1);

                    // Explicitly cast to prevent type errors about 'SearchResult' assignability
                    const result: SearchResult = {
                        file: file.startsWith('./') ? file.substring(2) : file,
                        line: lineNum,
                        text: text.trim(),
                        matchType: 'content' as const
                    };
                    return result;
                })
                .filter((item): item is SearchResult => item !== null);
        }

        res.status(200).json({ results });

    } catch (error: any) {
        console.error('Search failed:', error);
        if (error.code === 1 && error.stdout === '') {
            // grep returns 1 for no matches
            return res.status(200).json({ results: [] });
        }
        res.status(500).json({ error: error.message });
    }
}
