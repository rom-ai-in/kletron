/**
 * set_placeholder_text - Set text in a placeholder by index
 */

import { getPresentation } from "./presentationState.js";

export const setPlaceholderText = {
    description: "Set text content in a specific placeholder on a slide. Use get_slide_placeholders first to see available placeholders.",
    inputSchema: {
        type: "object",
        properties: {
            slideIndex: {
                type: "number",
                description: "Zero-based slide index",
                minimum: 0,
            },
            placeholderIdx: {
                type: "number",
                description: "Placeholder index (from get_slide_placeholders)",
                minimum: 0,
            },
            text: {
                type: "string",
                description: "Text to set in the placeholder",
            },
        },
        required: ["slideIndex", "placeholderIdx", "text"],
    },
    async run({ slideIndex, placeholderIdx, text }) {
        const pres = getPresentation();

        if (slideIndex < 0 || slideIndex >= pres.slides.length) {
            throw new Error(`Invalid slide index: ${slideIndex}. Presentation has ${pres.slides.length} slides.`);
        }

        const slide = pres.slides[slideIndex];
        const layoutElements = slide._layoutElements || [];

        if (placeholderIdx < 0 || placeholderIdx >= layoutElements.length) {
            throw new Error(`Invalid placeholder index: ${placeholderIdx}. Slide has ${layoutElements.length} placeholders.`);
        }

        const placeholder = layoutElements[placeholderIdx];

        // Determine text styling based on placeholder type
        const textOptions = {
            x: placeholder.x,
            y: placeholder.y,
            w: placeholder.w,
            h: placeholder.h,
            fontSize: placeholder.fontSize || 18,
            fontFace: "Arial",
            color: placeholder.type.includes("title") ? "1A1A2E" : "333333",
            bold: placeholder.bold || false,
            align: placeholder.align || "left",
            valign: "top",
        };

        // Add the text to the slide
        slide.addText(text, textOptions);

        return {
            ok: true,
            slideIndex,
            placeholderIdx,
            type: placeholder.type,
            textLength: text.length,
        };
    },
};
