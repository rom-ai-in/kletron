/**
 * add_slide_by_layout - Add a slide using a named layout
 */

import { getPresentation } from "./presentationState.js";

// Layout definitions with positioning
const LAYOUTS = {
    "Title": {
        description: "Title slide with centered title and subtitle",
        elements: [
            { type: "title", x: 0.5, y: 2.5, w: "90%", h: 1.5, fontSize: 44, bold: true, align: "center" },
            { type: "subtitle", x: 0.5, y: 4.2, w: "90%", h: 0.8, fontSize: 24, align: "center" },
        ],
    },
    "Title and Content": {
        description: "Title at top with content area below",
        elements: [
            { type: "title", x: 0.5, y: 0.4, w: "90%", h: 0.8, fontSize: 28, bold: true },
            { type: "content", x: 0.5, y: 1.4, w: "90%", h: 4.8, fontSize: 18 },
        ],
    },
    "Section Header": {
        description: "Section divider with large centered text",
        elements: [
            { type: "title", x: 0.5, y: 2.8, w: "90%", h: 1.2, fontSize: 36, bold: true, align: "center" },
        ],
    },
    "Two Content": {
        description: "Title with two side-by-side content areas",
        elements: [
            { type: "title", x: 0.5, y: 0.4, w: "90%", h: 0.8, fontSize: 28, bold: true },
            { type: "content_left", x: 0.5, y: 1.4, w: "44%", h: 4.8, fontSize: 16 },
            { type: "content_right", x: 6.8, y: 1.4, w: "44%", h: 4.8, fontSize: 16 },
        ],
    },
    "Comparison": {
        description: "Title with two comparison columns",
        elements: [
            { type: "title", x: 0.5, y: 0.4, w: "90%", h: 0.8, fontSize: 28, bold: true },
            { type: "header_left", x: 0.5, y: 1.2, w: "44%", h: 0.5, fontSize: 20, bold: true },
            { type: "header_right", x: 6.8, y: 1.2, w: "44%", h: 0.5, fontSize: 20, bold: true },
            { type: "content_left", x: 0.5, y: 1.8, w: "44%", h: 4.4, fontSize: 16 },
            { type: "content_right", x: 6.8, y: 1.8, w: "44%", h: 4.4, fontSize: 16 },
        ],
    },
    "Title Only": {
        description: "Just a title, rest is blank for custom content",
        elements: [
            { type: "title", x: 0.5, y: 0.4, w: "90%", h: 0.8, fontSize: 28, bold: true },
        ],
    },
    "Blank": {
        description: "Completely blank slide",
        elements: [],
    },
};

export const addSlideByLayout = {
    description: `Add a slide using a specific layout name. Available layouts: ${Object.keys(LAYOUTS).join(", ")}`,
    inputSchema: {
        type: "object",
        properties: {
            layoutName: {
                type: "string",
                description: `Name of the layout. Options: ${Object.keys(LAYOUTS).join(", ")}`,
                enum: Object.keys(LAYOUTS),
            },
        },
        required: ["layoutName"],
    },
    async run({ layoutName }) {
        const pres = getPresentation();

        // Find layout (case-insensitive)
        const layoutKey = Object.keys(LAYOUTS).find(
            k => k.toLowerCase() === layoutName.toLowerCase()
        );

        if (!layoutKey) {
            throw new Error(`Unknown layout: ${layoutName}. Available: ${Object.keys(LAYOUTS).join(", ")}`);
        }

        const layout = LAYOUTS[layoutKey];
        const slide = pres.addSlide();

        // Store layout info as slide metadata (for placeholder reference)
        slide._layoutName = layoutKey;
        slide._layoutElements = layout.elements;

        const slideIndex = pres.slides.length - 1;

        return {
            slideIndex,
            slideNumber: slideIndex + 1,
            layoutUsed: layoutKey,
            description: layout.description,
            placeholders: layout.elements.map((el, idx) => ({
                idx,
                type: el.type,
                position: { x: el.x, y: el.y, w: el.w, h: el.h },
            })),
        };
    },
};
