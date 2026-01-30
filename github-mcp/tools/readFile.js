import fs from "fs/promises";
import path from "path";
import { resolveRepoPath, ensurePathInside } from "./pathUtils.js";

// Office file extensions that need text extraction
const officeExtensions = ['.pptx', '.docx', '.xlsx', '.ppt', '.doc', '.xls', '.odt', '.odp', '.ods', '.pdf'];

export const readFile = {
    description: "Read a file from a repository. For Office documents (PPTX, DOCX, etc.), extracts text content automatically.",
    inputSchema: {
        type: "object",
        properties: {
            repoPath: {
                type: "string",
                description: "Root path of the repository. Optional if defaultDir is configured."
            },
            filePath: { type: "string" }
        },
        required: ["filePath"]
    },
    async run({ repoPath, filePath }) {
        const resolvedRoot = resolveRepoPath(repoPath);
        const resolvedFilePath = path.isAbsolute(filePath)
            ? path.resolve(filePath)
            : path.resolve(resolvedRoot, filePath);

        ensurePathInside(resolvedRoot, resolvedFilePath);

        const ext = path.extname(resolvedFilePath).toLowerCase();

        // Check if this is an Office file that needs text extraction
        if (officeExtensions.includes(ext)) {
            try {
                // Dynamic import to avoid issues in non-CommonJS environments
                const { parseOffice } = await import('officeparser');

                // parseOffice returns an object with toText() method
                const result = await parseOffice(resolvedFilePath);
                const text = result.toText ? result.toText() : String(result);

                if (!text || text.trim().length === 0) {
                    return `[Office file: ${path.basename(resolvedFilePath)}]\n\nNo text content could be extracted from this file. It may contain only images or other non-text elements.`;
                }

                // Include metadata if available
                const meta = result.metadata || {};
                const header = `[Office file: ${path.basename(resolvedFilePath)}]` +
                    (meta.title ? `\nTitle: ${meta.title}` : '') +
                    (meta.author ? `\nAuthor: ${meta.author}` : '');

                return `${header}\n\nExtracted text content:\n\n${text}`;
            } catch (err) {
                // If officeparser fails, return a helpful message
                return `[Office file: ${path.basename(resolvedFilePath)}]\n\nUnable to extract text content: ${err.message}\n\nThis is a binary Office file. Consider:\n- Using 'list_slides' tool for PowerPoint files\n- Asking the user for a text summary of the content`;
            }
        }

        // For regular text files, read as UTF-8
        return await fs.readFile(resolvedFilePath, "utf-8");
    }
};
