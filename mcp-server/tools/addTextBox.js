/**
 * add_text_box - Add a text box at a specific position
 */

import { getPresentation } from "./presentationState.js";

export const addTextBox = {
    description: "Add a text box to a slide at a specific position. Positions are in inches from top-left.",
    inputSchema: {
        type: "object",
        properties: {
            slideIndex: {
                type: "number",
                description: "Zero-based slide index",
                minimum: 0,
            },
            text: {
                type: "string",
                description: "Text content for the text box",
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
                description: "Width in inches",
                minimum: 0.1,
            },
            height: {
                type: "number",
                description: "Height in inches (optional, auto-calculated if not provided)",
                minimum: 0.1,
            },
            fontSize: {
                type: "number",
                description: "Font size in points (default: 14)",
                minimum: 6,
            },
            fontFace: {
                type: "string",
                description: "Font name (default: Arial)",
            },
            color: {
                type: "string",
                description: "Text color as hex (default: 333333)",
            },
            bold: {
                type: "boolean",
                description: "Bold text (default: false)",
            },
            italic: {
                type: "boolean",
                description: "Italic text (default: false)",
            },
            align: {
                type: "string",
                description: "Text alignment: left, center, right (default: left)",
                enum: ["left", "center", "right"],
            },
        },
        required: ["slideIndex", "text", "left", "top", "width"],
    },
    async run({
        slideIndex,
        text,
        left,
        top,
        width,
        height,
        fontSize = 14,
        fontFace = "Arial",
        color = "333333",
        bold = false,
        italic = false,
        align = "left"
    }) {
        const pres = getPresentation();

        if (slideIndex < 0 || slideIndex >= pres.slides.length) {
            throw new Error(`Invalid slide index: ${slideIndex}. Presentation has ${pres.slides.length} slides.`);
        }

        const slide = pres.slides[slideIndex];

        const textOptions = {
            x: left,
            y: top,
            w: width,
            fontSize,
            fontFace,
            color,
            bold,
            italic,
            align,
            valign: "top",
        };

        if (height) {
            textOptions.h = height;
        }

        slide.addText(text, textOptions);

        return {
            ok: true,
            slideIndex,
            position: { left, top, width, height: height || "auto" },
            textLength: text.length,
        };
    },
};
