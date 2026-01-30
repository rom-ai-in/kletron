/**
 * add_content_slide - Add a content slide with title and body
 * 
 * When using a template (via pptx-automizer): Adds slide from template and modifies placeholders
 * When using blank presentation: Creates slide with programmatic styling
 */

import {
    getPresentation,
    isUsingAutomizer,
    getPptxGenInstance,
    getTemplateInfo,
    trackSlide
} from "./presentationState.js";
import { ModifyTextHelper } from "pptx-automizer";

export const addContentSlide = {
    description: "Add a content slide with a title and body text. When using a template, preserves the template's content slide styling.",
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
            templateSlideNumber: {
                type: "number",
                description: "Slide number from the template to use as base (default: 7 for content slide with Title 1 + Text Placeholders 2/3/4). Use list_template_layouts to see available slides.",
            },
        },
        required: ["title", "content"],
    },
    async run({ title, content, templateSlideNumber = 7 }) {
        const pres = getPresentation();

        if (isUsingAutomizer()) {
            // pptx-automizer: Add slide from template and modify text
            const template = getTemplateInfo();

            // Helper function to inject text directly into XML (workaround for empty placeholders)
            const injectText = (element, text) => {
                const txBody = element.getElementsByTagName('p:txBody')[0];
                if (!txBody) return false;

                const paragraph = txBody.getElementsByTagName('a:p')[0];
                if (!paragraph) return false;

                // Clear existing text runs first
                const existingRuns = paragraph.getElementsByTagName('a:r');
                while (existingRuns.length > 0) {
                    existingRuns[0].parentNode.removeChild(existingRuns[0]);
                }

                // Create new text run with the text
                const doc = element.ownerDocument;
                const aR = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:r');
                const aT = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:t');
                aT.textContent = text;
                aR.appendChild(aT);

                // Insert before endParaRPr if it exists, otherwise append
                const endParaRPr = paragraph.getElementsByTagName('a:endParaRPr')[0];
                if (endParaRPr) {
                    paragraph.insertBefore(aR, endParaRPr);
                } else {
                    paragraph.appendChild(aR);
                }
                return true;
            };

            try {
                // Add slide from the template and modify placeholders using direct XML injection
                pres.addSlide(template.label, templateSlideNumber, (slide) => {
                    // Modify title - try multiple placeholder names
                    const titleNames = ["Title 1", "Title 5", "Title"];
                    for (const name of titleNames) {
                        try {
                            slide.modifyElement(name, (element) => injectText(element, title));
                            break;
                        } catch {
                            // Try next name
                        }
                    }

                    // Modify content placeholder - try Slide 7 placeholders first
                    const contentNames = [
                        "Text Placeholder 2",      // Slide 7 - main content
                        "Text Placeholder 3",      // Slide 7 - second content area
                        "Text Placeholder 4",      // Slide 7 - third content area  
                        "Content Placeholder 4",   // Slides 9, 11
                        "Text Placeholder 5",      // Various slides
                        "Content Placeholder 1",   // Slides 17-20
                        "Subtitle 2"               // Fallback
                    ];
                    for (const name of contentNames) {
                        try {
                            slide.modifyElement(name, (element) => injectText(element, content));
                            break;
                        } catch {
                            // Try next name
                        }
                    }
                });

                const lines = content.split("\n").filter(line => line.trim());
                const slideIndex = trackSlide({ type: "content", title, templateSlide: templateSlideNumber });

                return {
                    slideIndex,
                    slideNumber: slideIndex + 1,
                    type: "content",
                    title,
                    contentLines: lines.length,
                    templateSlideUsed: templateSlideNumber,
                    templatePreserved: true,
                };
            } catch (err) {
                throw new Error(`Failed to add content slide from template: ${err.message}`);
            }
        } else {
            // pptxgenjs fallback: Create slide with manual styling
            const pptxGen = getPptxGenInstance();
            if (!pptxGen) {
                throw new Error("No presentation instance available.");
            }

            const slide = pptxGen.addSlide();

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

            const slideIndex = pptxGen.slides.length - 1;
            trackSlide({ type: "content", title });

            return {
                slideIndex,
                slideNumber: slideIndex + 1,
                type: "content",
                title,
                contentLines: lines.length,
                templatePreserved: false,
            };
        }
    },
};
