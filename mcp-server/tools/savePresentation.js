/**
 * save_presentation - Save the presentation to a file
 */

import fs from "fs/promises";
import path from "path";
import {
    getPresentation,
    clearPresentation,
    getOutputDir,
    hasPresentation,
    isUsingAutomizer,
    getPptxGenInstance,
    getAddedSlides,
    clearAddedSlides
} from "./presentationState.js";
import { resolveRepoPath } from "./pathUtils.js";

export const savePresentation = {
    description: "Save the current presentation to a .pptx file. Preserves template styling if a template was loaded.",
    inputSchema: {
        type: "object",
        properties: {
            outputPath: {
                type: "string",
                description: "Output file path for the .pptx file. Can be absolute or relative to working folder.",
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
            // Just a filename - save to working folder
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

        let slidesCount = 0;
        let fileSize = 0;

        if (isUsingAutomizer()) {
            // pptx-automizer: write() method writes to the configured outputDir
            const filename = path.basename(resolvedPath);
            const automizeroOutputDir = getOutputDir(); // Where automizer writes
            const automizeroOutputPath = path.join(automizeroOutputDir, filename);

            // Write to automizer's output directory
            const summary = await pres.write(filename);

            // If the requested path is different from automizer's output, move the file
            if (resolvedPath !== automizeroOutputPath) {
                try {
                    await fs.rename(automizeroOutputPath, resolvedPath);
                } catch (moveErr) {
                    // If rename fails (cross-device), copy and delete
                    await fs.copyFile(automizeroOutputPath, resolvedPath);
                    await fs.unlink(automizeroOutputPath);
                }
            }

            // Get file stats from the final location
            const stats = await fs.stat(resolvedPath);
            fileSize = stats.size;
            slidesCount = getAddedSlides().length;
        } else {
            // pptxgenjs fallback: use write() with nodebuffer
            const pptxGen = getPptxGenInstance();
            if (pptxGen) {
                const data = await pptxGen.write({ outputType: "nodebuffer" });
                await fs.writeFile(resolvedPath, data);

                const stats = await fs.stat(resolvedPath);
                fileSize = stats.size;
                slidesCount = pptxGen.slides?.length || 0;
            } else {
                throw new Error("No valid presentation instance found.");
            }
        }

        // Clear presentation if requested
        if (clearAfterSave) {
            clearPresentation();
            clearAddedSlides();
        }

        return {
            ok: true,
            filePath: resolvedPath,
            fileName: path.basename(resolvedPath),
            bytesWritten: fileSize,
            slidesCount,
            templatePreserved: isUsingAutomizer(),
            cleared: clearAfterSave,
        };
    },
};
