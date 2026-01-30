/**
 * add_content_slide - Add a content slide with title and body
 */

import { getPresentation } from "./presentationState.js";

export const addContentSlide = {
    description: "Add a content slide with a title and body text to the current presentation.",
    inputSchema: {
        type: "object",
        properties: {
            title: {
                type: "string",
                description: "Slide title",
            },
            content: {
                type: "string",
                description: "Body content text. Use \\n for line breaks and • for bullet points.",
            },
        },
        required: ["title", "content"],
    },
    async run({ title, content }) {
        const pres = getPresentation();
        const slide = pres.addSlide();

        // Add title at top
        slide.addText(title, {
            x: 0.5,
            y: 0.4,
            w: "90%",
            h: 0.8,
            fontSize: 28,
            fontFace: "Arial",
            bold: true,
            color: "1A1A2E",
        });

        // Parse content for bullet points
        const lines = content.split("\n").filter(line => line.trim());
        const textItems = lines.map(line => {
            const isBullet = line.trim().startsWith("•") || line.trim().startsWith("-") || line.trim().startsWith("*");
            const cleanLine = line.trim().replace(/^[•\-\*]\s*/, "");
            return {
                text: cleanLine,
                options: {
                    bullet: isBullet ? { type: "bullet" } : false,
                    fontSize: 18,
                    fontFace: "Arial",
                    color: "333333",
                    breakLine: true,
                },
            };
        });

        // Add content body
        slide.addText(textItems, {
            x: 0.5,
            y: 1.4,
            w: "90%",
            h: 4.5,
            valign: "top",
            paraSpaceAfter: 8,
        });

        const slideIndex = pres.slides.length - 1;

        return {
            slideIndex,
            slideNumber: slideIndex + 1,
            type: "content",
            title,
            contentLines: lines.length,
        };
    },
};
