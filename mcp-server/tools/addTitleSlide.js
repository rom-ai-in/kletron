/**
 * add_title_slide - Add a title slide to the presentation
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

export const addTitleSlide = {
    description: "Add a title slide with a main title and optional subtitle. When using a template, preserves the template's title slide styling.",
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
            templateSlideNumber: {
                type: "number",
                description: "Slide number from the template to use as base (default: 3 for title slide with Title 1 + Subtitle 2). Use list_template_layouts to see available slides.",
            },
        },
        required: ["title"],
    },
    async run({ title, subtitle, templateSlideNumber = 3 }) {
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

                    // Modify subtitle if provided
                    if (subtitle) {
                        const subtitleNames = ["Subtitle 2", "Text Placeholder 5", "Subtitle"];
                        for (const name of subtitleNames) {
                            try {
                                slide.modifyElement(name, (element) => injectText(element, subtitle));
                                break;
                            } catch {
                                // Try next name
                            }
                        }
                    }
                });

                const slideIndex = trackSlide({ type: "title", title, subtitle, templateSlide: templateSlideNumber });

                return {
                    slideIndex,
                    slideNumber: slideIndex + 1,
                    type: "title",
                    title,
                    subtitle: subtitle || null,
                    templateSlideUsed: templateSlideNumber,
                    templatePreserved: true,
                };
            } catch (err) {
                throw new Error(`Failed to add title slide from template: ${err.message}`);
            }
        } else {
            // pptxgenjs fallback: Create slide with manual styling
            const pptxGen = getPptxGenInstance();
            if (!pptxGen) {
                throw new Error("No presentation instance available.");
            }

            const slide = pptxGen.addSlide();

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

            const slideIndex = pptxGen.slides.length - 1;
            trackSlide({ type: "title", title, subtitle });

            return {
                slideIndex,
                slideNumber: slideIndex + 1,
                type: "title",
                title,
                subtitle: subtitle || null,
                templatePreserved: false,
            };
        }
    },
};
