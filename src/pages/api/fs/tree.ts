import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { getConfig } from '@/src/config';

export interface TreeNode {
    path: string;
    name: string;
    isDirectory: boolean;
    children?: TreeNode[];
}

function buildTree(currentPath: string, depth: number = 0, maxDepth: number = 5): TreeNode[] {
    if (depth > maxDepth) return [];

    const nodes: TreeNode[] = [];
    try {
        const files = fs.readdirSync(currentPath);

        // Sort: Directories first, then files. Alphabetical order within groups.
        files.sort((a, b) => {
            const aPath = path.join(currentPath, a);
            const bPath = path.join(currentPath, b);
            const aIsDir = fs.statSync(aPath).isDirectory();
            const bIsDir = fs.statSync(bPath).isDirectory();

            if (aIsDir && !bIsDir) return -1;
            if (!aIsDir && bIsDir) return 1;
            return a.localeCompare(b);
        });

        for (const file of files) {
            // Skip hidden files/folders (except specific ones if needed)
            if (file.startsWith('.') && file !== '.agent') continue;
            if (file === 'node_modules') continue;

            const fullPath = path.join(currentPath, file);
            let stats;
            try {
                stats = fs.statSync(fullPath);
            } catch (e) {
                continue; // Skip if stat fails (e.g. broken link)
            }

            const isDirectory = stats.isDirectory();

            const node: TreeNode = {
                path: fullPath,
                name: file,
                isDirectory
            };

            if (isDirectory) {
                node.children = buildTree(fullPath, depth + 1, maxDepth);
            }

            nodes.push(node);
        }
    } catch (error) {
        console.error(`Error reading directory ${currentPath}:`, error);
    }
    return nodes;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        const { root } = req.query;
        const config = await getConfig();
        const repoRoot = config.mcpDefaultDir;
        console.log(`[FileTreeAPI] Loaded RepoRoot: ${repoRoot}`);
        console.log(`[FileTreeAPI] Request Root Query: ${root}`);

        let rootPath = repoRoot;

        if (typeof root === 'string' && root) {
            const resolvedRoot = path.isAbsolute(root) ? path.resolve(root) : path.resolve(repoRoot, root);
            if (resolvedRoot.startsWith(repoRoot)) {
                rootPath = resolvedRoot;
            } else {
                return res.status(403).json({ error: 'Access denied: root outside of repository root' });
            }
        }

        const tree = buildTree(rootPath);
        res.status(200).json(tree);
    } catch (error) {
        res.status(500).json({ error: 'Failed to build file tree' });
    }
}
