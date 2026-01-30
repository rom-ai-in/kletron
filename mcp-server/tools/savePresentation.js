/**
 * save_presentation - Save the presentation to a file
 */

import fs from "fs/promises";
import path from "path";
import { getPresentation, clearPresentation, getOutputDir, hasPresentation } from "./presentationState.js";
import { resolveRepoPath } from "./pathUtils.js";

export const savePresentation = {
    description: "Save the current presentation to a .pptx file. Creates the output directory if needed.",
    inputSchema: {
        type: "object",
        properties: {
            outputPath: {
                type: "string",
                description: "Output file path for the .pptx file. Can be absolute or relative to working folder. If just a filename, saves to Generated/ folder.",
            },
            clearAfterSave: {
                type: "boolean",
                description: "Clear the presentation from memory after saving (default: true)",
            },
        },
        required: ["outputPath"],
    },
    async run({ outputPath, clearAfterSave = true }) {
        if (!hasPresentation()) {
            throw new Error("No presentation is currently open. Call create_presentation first.");
        }

        const pres = getPresentation();

        // Resolve output path
        let resolvedPath;
        if (path.isAbsolute(outputPath)) {
            resolvedPath = outputPath;
        } else if (outputPath.includes("/") || outputPath.includes("\\")) {
            // Relative path with directories
            resolvedPath = path.resolve(resolveRepoPath(), outputPath);
        } else {
            // Just a filename - save to Generated folder
            const outputDir = getOutputDir();
            await fs.mkdir(outputDir, { recursive: true });
            resolvedPath = path.join(outputDir, outputPath);
        }

        // Ensure .pptx extension
        if (!resolvedPath.endsWith(".pptx")) {
            resolvedPath += ".pptx";
        }

        // Ensure output directory exists
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

        // Save the presentation
        // PptxGenJS write returns a Promise that resolves to the file data
        const data = await pres.write({ outputType: "nodebuffer" });
        await fs.writeFile(resolvedPath, data);

        // Get file stats
        const stats = await fs.stat(resolvedPath);

        // Clear presentation if requested
        if (clearAfterSave) {
            clearPresentation();
        }

        return {
            ok: true,
            filePath: resolvedPath,
            fileName: path.basename(resolvedPath),
            bytesWritten: stats.size,
            slidesCount: pres.slides.length,
            cleared: clearAfterSave,
        };
    },
};
