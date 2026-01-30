/**
 * get_slide_placeholders - Get available placeholders on a slide
 */

import { getPresentation } from "./presentationState.js";

export const getSlidePlaceholders = {
    description: "Get available placeholders on a specific slide. Useful for understanding slide layout before setting text.",
    inputSchema: {
        type: "object",
        properties: {
            slideIndex: {
                type: "number",
                description: "Zero-based slide index",
                minimum: 0,
            },
        },
        required: ["slideIndex"],
    },
    async run({ slideIndex }) {
        const pres = getPresentation();

        if (slideIndex < 0 || slideIndex >= pres.slides.length) {
            throw new Error(`Invalid slide index: ${slideIndex}. Presentation has ${pres.slides.length} slides (0-${pres.slides.length - 1}).`);
        }

        const slide = pres.slides[slideIndex];

        // Check for layout metadata
        const layoutName = slide._layoutName || "Custom";
        const layoutElements = slide._layoutElements || [];

        // Get actual objects on the slide
        const objects = slide._slideObjects || [];

        return {
            slideIndex,
            slideNumber: slideIndex + 1,
            layoutName,
            placeholders: layoutElements.map((el, idx) => ({
                idx,
                type: el.type,
                x: el.x,
                y: el.y,
                w: el.w,
                h: el.h,
                fontSize: el.fontSize,
                bold: el.bold || false,
                align: el.align || "left",
            })),
            objectsCount: objects.length,
        };
    },
};
