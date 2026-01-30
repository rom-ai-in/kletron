/**
 * create_presentation - Create a new PowerPoint presentation from a template
 */

import {
    createAutomizerSession,
    createBlankPresentation,
    hasPresentation,
    clearPresentation,
    resolveTemplatePath,
    clearAddedSlides
} from "./presentationState.js";

export const createPresentation = {
    description: "Create a new PowerPoint presentation. If templateName is provided, the template's styling, branding, and layouts will be preserved. Returns the presentation ID and available slide info.",
    inputSchema: {
        type: "object",
        properties: {
            templateName: {
                type: "string",
                description: "Name of a template to load (from the PowerPoint/ directory). The template's branding, colors, fonts, and layouts will be preserved in the output.",
            },
            title: {
                type: "string",
                description: "Title of the presentation (metadata).",
            },
            author: {
                type: "string",
                description: "Author of the presentation (metadata).",
            },
            company: {
                type: "string",
                description: "Company name (metadata).",
            },
            subject: {
                type: "string",
                description: "Subject of the presentation (metadata).",
            },
        },
    },
    async run({ templateName, title, author, company, subject } = {}) {
        // Clear any existing presentation
        if (hasPresentation()) {
            clearPresentation();
        }
        clearAddedSlides();

        // If template specified, try to load it with automizer
        if (templateName) {
            console.log("[DEBUG createPresentation] Looking for template:", templateName);
            const templatePath = await resolveTemplatePath(templateName);
            console.log("[DEBUG createPresentation] Resolved path:", templatePath);

            if (templatePath) {
                try {
                    console.log("[DEBUG createPresentation] Creating automizer session...");
                    const { id, template } = await createAutomizerSession(templatePath, {
                        title,
                        author,
                        company,
                        subject,
                    });
                    console.log("[DEBUG createPresentation] Session created successfully");

                    return {
                        id,
                        message: `Created presentation from template: ${template.name}`,
                        templateLoaded: true,
                        templateName: template.name,
                        templatePath: template.path,
                        layout: "LAYOUT_WIDE (16:9)",
                        slidesCount: 0,
                        note: "Use add_title_slide and add_content_slide to add slides from the template. The template's branding and styles will be preserved.",
                    };
                } catch (err) {
                    // Fall back to blank if template loading fails
                    console.error("[DEBUG createPresentation] Template loading FAILED:", err.message, err.stack);
                }
            } else {
                console.warn(`[DEBUG createPresentation] Template not found: ${templateName}. Creating blank presentation.`);
            }
        }

        // Fallback: create blank presentation with pptxgenjs
        const { pres, id } = createBlankPresentation();

        // Set metadata if provided
        if (title) pres.title = title;
        if (author) pres.author = author;
        if (company) pres.company = company;
        if (subject) pres.subject = subject;

        return {
            id,
            message: templateName
                ? `Template '${templateName}' not found. Created blank presentation instead.`
                : "Created new blank presentation",
            templateLoaded: false,
            layout: "LAYOUT_WIDE (16:9)",
            slidesCount: 0,
            warning: templateName ? "Template styling will NOT be applied. Consider using list_templates to find available templates." : undefined,
        };
    },
};
