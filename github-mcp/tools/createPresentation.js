/**
 * create_presentation - Create a new PowerPoint presentation
 */

import { createNewPresentation, hasPresentation, clearPresentation } from "./presentationState.js";

export const createPresentation = {
    description: "Create a new PowerPoint presentation. If a presentation is already open, it will be replaced. Returns the presentation ID.",
    inputSchema: {
        type: "object",
        properties: {
            templateName: {
                type: "string",
                description: "Optional name of a template to base the presentation on. Note: pptxgenjs creates new presentations; template styles must be manually applied.",
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

        // Create new presentation
        const { pres, id } = createNewPresentation();

        // Set metadata if provided
        if (title) pres.title = title;
        if (author) pres.author = author;
        if (company) pres.company = company;
        if (subject) pres.subject = subject;

        // Set Forvis Mazars branding defaults
        pres.layout = "LAYOUT_WIDE"; // 16:9 widescreen

        // Define default theme colors (Forvis Mazars brand)
        pres.defineSlideMaster({
            title: "FORVIS_MAZARS",
            background: { color: "FFFFFF" },
            objects: [],
        });

        return {
            id,
            message: templateName
                ? `Created new presentation (template reference: ${templateName})`
                : "Created new blank presentation",
            slidesCount: 0,
            layout: "LAYOUT_WIDE (16:9)",
        };
    },
};
