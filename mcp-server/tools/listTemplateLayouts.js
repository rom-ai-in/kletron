/**
 * list_template_layouts - Get information about slide layouts in a template
 */

import fs from "fs/promises";
import path from "path";
import Automizer from "pptx-automizer";
import { getTemplatesDir, resolveTemplatePath } from "./presentationState.js";

export const listTemplateLayouts = {
    description: "Inspect a PowerPoint template to see available slide layouts and their structure. Helps determine which slide number to use when adding slides.",
    inputSchema: {
        type: "object",
        properties: {
            templateName: {
                type: "string",
                description: "Name of the template to inspect (from PowerPoint/ directory)",
            },
        },
        required: ["templateName"],
    },
    async run({ templateName }) {
        const templatePath = await resolveTemplatePath(templateName);

        if (!templatePath) {
            return {
                error: true,
                message: `Template not found: ${templateName}`,
                availableTemplates: "Use list_templates to see available templates.",
            };
        }

        try {
            const templatesDir = getTemplatesDir();

            // Create a temporary automizer instance to inspect the template
            const automizer = new Automizer({
                templateDir: templatesDir,
                outputDir: templatesDir, // Won't actually save
                removeExistingSlides: false, // Keep slides for inspection
                verbosity: 0,
            });

            const templateFilename = path.basename(templatePath);

            // Load the template
            const pres = automizer.loadRoot(templateFilename);

            // Get presentation info
            const presInfo = await pres.getInfo();

            // Get slides info for this template
            const slides = presInfo.slidesByTemplate(templateFilename);

            const slideInfo = slides.map((slide, index) => ({
                slideNumber: index + 1,
                creationId: slide.creationId || null,
                layoutName: slide.layoutName || "Unknown",
                // List element names that can be modified
                elements: (slide.elements || []).map(el => ({
                    name: el.name,
                    type: el.type || "shape",
                })),
            }));

            return {
                templateName: path.basename(templatePath, path.extname(templatePath)),
                templatePath,
                totalSlides: slides.length,
                slides: slideInfo,
                usage: "Use templateSlideNumber parameter in add_title_slide or add_content_slide to use these layouts.",
            };
        } catch (err) {
            // If detailed inspection fails, return basic info
            return {
                templateName: path.basename(templatePath, path.extname(templatePath)),
                templatePath,
                note: "Could not fully inspect template. Use slide numbers 1, 2, 3... when adding slides.",
                error: err.message,
            };
        }
    },
};
