/**
 * add_image_to_slide - Add an image to a slide
 */

import fs from "fs/promises";
import path from "path";
import { getPresentation } from "./presentationState.js";
import { resolveRepoPath } from "./pathUtils.js";

export const addImageToSlide = {
    description: "Add an image to a slide at a specific position. Supports PNG, JPG, GIF, SVG formats.",
    inputSchema: {
        type: "object",
        properties: {
            slideIndex: {
                type: "number",
                description: "Zero-based slide index",
                minimum: 0,
            },
            imagePath: {
                type: "string",
                description: "Path to the image file (absolute or relative to working folder)",
            },
            left: {
                type: "number",
                description: "Left position in inches from slide left edge",
                minimum: 0,
            },
            top: {
                type: "number",
                description: "Top position in inches from slide top edge",
                minimum: 0,
            },
            width: {
                type: "number",
                description: "Width in inches (optional, maintains aspect ratio if only width or height provided)",
                minimum: 0.1,
            },
            height: {
                type: "number",
                description: "Height in inches (optional)",
                minimum: 0.1,
            },
        },
        required: ["slideIndex", "imagePath", "left", "top"],
    },
    async run({ slideIndex, imagePath, left, top, width, height }) {
        const pres = getPresentation();

        if (slideIndex < 0 || slideIndex >= pres.slides.length) {
            throw new Error(`Invalid slide index: ${slideIndex}. Presentation has ${pres.slides.length} slides.`);
        }

        // Resolve image path
        const resolvedPath = path.isAbsolute(imagePath)
            ? imagePath
            : path.resolve(resolveRepoPath(), imagePath);

        // Check if file exists
        try {
            await fs.access(resolvedPath);
        } catch {
            throw new Error(`Image file not found: ${resolvedPath}`);
        }

        // Get file extension
        const ext = path.extname(resolvedPath).toLowerCase();
        const supportedFormats = [".png", ".jpg", ".jpeg", ".gif", ".svg"];

        if (!supportedFormats.includes(ext)) {
            throw new Error(`Unsupported image format: ${ext}. Supported: ${supportedFormats.join(", ")}`);
        }

        const slide = pres.slides[slideIndex];

        const imageOptions = {
            path: resolvedPath,
            x: left,
            y: top,
        };

        if (width) imageOptions.w = width;
        if (height) imageOptions.h = height;

        slide.addImage(imageOptions);

        return {
            ok: true,
            slideIndex,
            imagePath: resolvedPath,
            position: { left, top, width: width || "auto", height: height || "auto" },
        };
    },
};
