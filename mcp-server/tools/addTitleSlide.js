/**
 * add_title_slide - Add a title slide to the presentation
 */

import { getPresentation } from "./presentationState.js";

export const addTitleSlide = {
    description: "Add a title slide with a main title and optional subtitle to the current presentation.",
    inputSchema: {
        type: "object",
        properties: {
            title: {
                type: "string",
                description: "Main title text",
            },
            subtitle: {
                type: "string",
                description: "Optional subtitle text",
            },
        },
        required: ["title"],
    },
    async run({ title, subtitle }) {
        const pres = getPresentation();
        const slide = pres.addSlide();

        // Add title - centered, large
        slide.addText(title, {
            x: 0.5,
            y: 2.5,
            w: "90%",
            h: 1.5,
            fontSize: 44,
            fontFace: "Arial",
            bold: true,
            color: "1A1A2E",
            align: "center",
            valign: "middle",
        });

        // Add subtitle if provided
        if (subtitle) {
            slide.addText(subtitle, {
                x: 0.5,
                y: 4.2,
                w: "90%",
                h: 0.8,
                fontSize: 24,
                fontFace: "Arial",
                color: "666666",
                align: "center",
                valign: "middle",
            });
        }

        const slideIndex = pres.slides.length - 1;

        return {
            slideIndex,
            slideNumber: slideIndex + 1,
            type: "title",
            title,
            subtitle: subtitle || null,
        };
    },
};
