/**
 * list_slides - List all slides in the current presentation
 */

import { getPresentation, hasPresentation, getPresentationId } from "./presentationState.js";

export const listSlides = {
    description: "List all slides in the current presentation with their basic information.",
    inputSchema: {
        type: "object",
        properties: {},
    },
    async run() {
        if (!hasPresentation()) {
            return {
                error: "No presentation is currently open. Call create_presentation first.",
                slidesCount: 0,
                slides: [],
            };
        }

        const pres = getPresentation();
        const presentationId = getPresentationId();

        const slides = pres.slides.map((slide, index) => {
            const layoutName = slide._layoutName || "Custom";
            const objects = slide._slideObjects || [];

            return {
                index,
                slideNumber: index + 1,
                layoutName,
                objectsCount: objects.length,
            };
        });

        return {
            presentationId,
            slidesCount: slides.length,
            slides,
            layout: pres.layout || "LAYOUT_WIDE",
            title: pres.title || "Untitled",
        };
    },
};
