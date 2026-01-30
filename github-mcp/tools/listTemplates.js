/**
 * list_templates - List available PowerPoint templates
 */

import { glob } from "glob";
import fs from "fs/promises";
import path from "path";
import { getTemplatesDir } from "./presentationState.js";

export const listTemplates = {
    description: "List available PowerPoint templates (.potx, .pptx) from the working folder's PowerPoint directory.",
    inputSchema: {
        type: "object",
        properties: {},
    },
    async run() {
        const templatesDir = getTemplatesDir();

        // Check if directory exists
        try {
            await fs.access(templatesDir);
        } catch {
            return {
                templates: [],
                message: `No PowerPoint directory found at: ${templatesDir}`,
            };
        }

        // Find all template files
        const patterns = ["**/*.potx", "**/*.pptx"];
        const files = await glob(patterns, {
            cwd: templatesDir,
            nodir: true,
            ignore: ["**/~$*"], // Ignore temp files
        });

        // Get file info for each template
        const templates = await Promise.all(
            files.map(async (file) => {
                const fullPath = path.join(templatesDir, file);
                const stats = await fs.stat(fullPath);
                return {
                    name: path.basename(file, path.extname(file)),
                    fileName: file,
                    path: fullPath,
                    extension: path.extname(file),
                    sizeBytes: stats.size,
                };
            })
        );

        return {
            templates,
            count: templates.length,
            directory: templatesDir,
        };
    },
};
