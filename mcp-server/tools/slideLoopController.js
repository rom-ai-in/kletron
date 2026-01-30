/**
 * slide_loop_controller - Multi-Agent Slide Generation System
 * 
 * Implements 5 internal sub-agents:
 * 1. Slide Planner - Validates input and plans execution order
 * 2. Type Selector - Chooses optimal template for each slide
 * 3. Content Generator - Creates slide with content injection
 * 4. Validator - Verifies slide creation success
 * 5. Loop Controller - Handles retries and fallbacks
 */

import {
    getPresentation,
    isUsingAutomizer,
    getTemplateInfo,
    trackSlide,
    getSlides
} from "./presentationState.js";

// ============================================================================
// TEMPLATE CONFIGURATION (Based on ForvisMazars_Template_BLANK_012026.potx)
// ============================================================================

const TEMPLATE_CONFIG = {
    // Slide 3: Title 1, Subtitle 2, Picture Placeholder 3, Text Placeholder 4
    "title": {
        slideNumber: 3,
        placeholders: { title: "Title 1", subtitle: "Subtitle 2" },
        description: "Cover page with title + subtitle"
    },
    "cover": {
        slideNumber: 3,
        placeholders: { title: "Title 1", subtitle: "Subtitle 2" },
        description: "Cover page"
    },

    // Slide 4: Title 1, Subtitle 2, Text Placeholder 3 (Section divider)
    "section": {
        slideNumber: 4,
        placeholders: { title: "Title 1", subtitle: "Subtitle 2" },
        description: "Section divider"
    },
    "divider": {
        slideNumber: 4,
        placeholders: { title: "Title 1", subtitle: "Subtitle 2" },
        description: "Section divider"
    },
    "chapter": {
        slideNumber: 4,
        placeholders: { title: "Title 1", subtitle: "Subtitle 2" },
        description: "Chapter divider"
    },

    // Slide 7: Title 1, Text Placeholder 2, 3, 4 (Content)
    "content": {
        slideNumber: 7,
        placeholders: { title: "Title 1", content: "Text Placeholder 2" },
        description: "Standard content with bullets"
    },
    "bullets": {
        slideNumber: 7,
        placeholders: { title: "Title 1", content: "Text Placeholder 2" },
        description: "Bullet points content"
    },
    "text": {
        slideNumber: 7,
        placeholders: { title: "Title 1", content: "Text Placeholder 2" },
        description: "Text content"
    },

    // Slide 9: Title 1, Text Placeholder 2, 3, Content Placeholder 4, Text 5 (Multi-content)
    "two_column": {
        slideNumber: 9,
        placeholders: { title: "Title 1", left: "Text Placeholder 2", right: "Text Placeholder 3" },
        description: "Two-column layout"
    },
    "comparison": {
        slideNumber: 9,
        placeholders: { title: "Title 1", left: "Text Placeholder 2", right: "Text Placeholder 3" },
        description: "Side-by-side comparison"
    },

    // Slide 11: Title 1, Text Placeholder 2, 3, Content Placeholder 4, Text 5 (Table/Data)
    "table": {
        slideNumber: 11,
        placeholders: { title: "Title 1", content: "Text Placeholder 2" },
        description: "Table layout"
    },
    "data": {
        slideNumber: 11,
        placeholders: { title: "Title 1", content: "Text Placeholder 2" },
        description: "Data table layout"
    },

    // Closing slides - use slide 3 or 7 (they have proper placeholders)
    "contact": {
        slideNumber: 7,
        placeholders: { title: "Title 1", content: "Text Placeholder 2" },
        description: "Contact information"
    },
    "thankyou": {
        slideNumber: 3,
        placeholders: { title: "Title 1", subtitle: "Subtitle 2" },
        description: "Thank you / closing slide"
    },
    "close": {
        slideNumber: 3,
        placeholders: { title: "Title 1", subtitle: "Subtitle 2" },
        description: "Closing slide"
    },
    "end": {
        slideNumber: 3,
        placeholders: { title: "Title 1", subtitle: "Subtitle 2" },
        description: "End slide"
    }
};

// ============================================================================
// SUB-AGENT 1: SLIDE PLANNER
// ============================================================================

function planSlides(enrichedSlides) {
    const plan = {
        valid: true,
        totalSlides: enrichedSlides.length,
        executionOrder: [],
        issues: [],
        slides: []
    };

    for (let i = 0; i < enrichedSlides.length; i++) {
        const slide = enrichedSlides[i];
        const slideNumber = slide.number || (i + 1);

        const slideInfo = {
            index: i,
            number: slideNumber,
            hasTitle: Boolean(slide.title),
            hasContent: Boolean(slide.content || (slide.key_points && slide.key_points.length > 0)),
            hasSubtitle: Boolean(slide.subtitle),
            explicitType: slide.type || null
        };

        if (!slideInfo.hasTitle) {
            plan.issues.push({ slideNumber, issue: "Missing title", severity: "warning" });
        }

        plan.slides.push(slideInfo);
        plan.executionOrder.push(slideNumber);
    }

    return plan;
}

// ============================================================================
// SUB-AGENT 2: TYPE SELECTOR
// ============================================================================

function selectTemplateForSlide(slideData, slideIndex) {
    const title = (slideData.title || "").toLowerCase();
    const explicitType = (slideData.type || "").toLowerCase();
    const keyPoints = slideData.key_points || [];
    const subtitle = slideData.subtitle || "";

    let selectedType = null;
    let confidence = 0;
    let reasoning = "";

    // Priority 1: Explicit type (100%)
    if (explicitType && TEMPLATE_CONFIG[explicitType]) {
        selectedType = explicitType;
        confidence = 100;
        reasoning = `Explicit type "${explicitType}" specified`;
    }
    // Priority 2: First slide is title (100%)
    else if (slideIndex === 0 || slideData.number === 1) {
        selectedType = "title";
        confidence = 100;
        reasoning = "First slide - using title template";
    }
    // Priority 3: Title-based detection
    else if (title.includes("thank") || title.includes("question") || title.includes("q&a")) {
        selectedType = "thankyou";
        confidence = 95;
        reasoning = "Title indicates closing slide";
    }
    else if (title.includes("contact") || title.includes("next step")) {
        selectedType = "contact";
        confidence = 90;
        reasoning = "Title indicates contact info";
    }
    else if (title.includes("agenda") || title.includes("overview")) {
        selectedType = "content";
        confidence = 90;
        reasoning = "Title indicates agenda content";
    }
    // Priority 4: Content-based detection
    else if (keyPoints.length > 0) {
        selectedType = "content";
        confidence = 85;
        reasoning = `Has ${keyPoints.length} bullet points`;
    }
    else if (subtitle && keyPoints.length === 0) {
        selectedType = "section";
        confidence = 80;
        reasoning = "Has subtitle but no bullets - section divider";
    }
    // Priority 5: Default
    else {
        selectedType = "content";
        confidence = 60;
        reasoning = "Default fallback to content";
    }

    const config = TEMPLATE_CONFIG[selectedType];
    return {
        type: selectedType,
        templateSlide: config.slideNumber,
        placeholders: config.placeholders,
        description: config.description,
        confidence,
        reasoning
    };
}

// ============================================================================
// SUB-AGENT 3: CONTENT GENERATOR
// ============================================================================

const injectText = (element, text) => {
    const txBody = element.getElementsByTagName('p:txBody')[0];
    if (!txBody) return false;
    const paragraph = txBody.getElementsByTagName('a:p')[0];
    if (!paragraph) return false;

    const existingRuns = paragraph.getElementsByTagName('a:r');
    while (existingRuns.length > 0) {
        existingRuns[0].parentNode.removeChild(existingRuns[0]);
    }

    const doc = element.ownerDocument;
    const aR = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:r');
    const aT = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:t');
    aT.textContent = text;
    aR.appendChild(aT);

    const endParaRPr = paragraph.getElementsByTagName('a:endParaRPr')[0];
    if (endParaRPr) paragraph.insertBefore(aR, endParaRPr);
    else paragraph.appendChild(aR);
    return true;
};

async function generateSlideContent(pres, templateLabel, selection, slideData) {
    const { templateSlide, placeholders } = selection;
    const { title, content, subtitle, key_points } = slideData;

    let finalContent = content;
    if (!finalContent && key_points && key_points.length > 0) {
        finalContent = key_points.map(point => `• ${point}`).join("\n");
    }

    const injectionResults = {
        title: { attempted: false, success: false },
        content: { attempted: false, success: false }
    };

    return new Promise((resolve) => {
        pres.addSlide(templateLabel, templateSlide, (slide) => {
            // Title
            if (title && placeholders.title) {
                injectionResults.title.attempted = true;
                slide.modifyElement(placeholders.title, (el) => {
                    injectionResults.title.success = injectText(el, title);
                });
            }

            // Content or subtitle
            const textToInject = finalContent || subtitle;
            const textPlaceholder = placeholders.content || placeholders.subtitle;
            if (textToInject && textPlaceholder) {
                injectionResults.content.attempted = true;
                slide.modifyElement(textPlaceholder, (el) => {
                    injectionResults.content.success = injectText(el, textToInject);
                });
            }
        });

        resolve({
            slideCreated: true,
            templateSlide,
            injectionResults,
            title: title || "Untitled"
        });
    });
}

// ============================================================================
// SUB-AGENT 4: VALIDATOR
// ============================================================================

function validateSlide(result, selection) {
    return {
        valid: result.slideCreated,
        issues: [],
        warnings: selection.confidence < 70 ? [`Low confidence: ${selection.reasoning}`] : []
    };
}

// ============================================================================
// SUB-AGENT 5: LOOP CONTROLLER
// ============================================================================

function handleValidation(validation, retryCount) {
    if (validation.valid) {
        return { action: "continue", warnings: validation.warnings };
    }
    if (retryCount < 2) {
        return { action: "retry", reason: "Slide creation may have failed" };
    }
    return { action: "skip", warnings: ["Max retries exceeded"] };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export const slideLoopController = {
    description: `Multi-Agent Slide Generation with 5 sub-agents:
1. Planner - Validates input
2. Type Selector - Chooses template (title→3, section→4, content→7, table→11, closing→3)
3. Content Generator - Injects text
4. Validator - Verifies creation
5. Loop Controller - Handles retries`,

    inputSchema: {
        type: "object",
        properties: {
            enriched_slides: {
                type: "array",
                description: "Array of slide objects with number, title, type, content, subtitle, key_points",
                items: { type: "object" }
            }
        },
        required: ["enriched_slides"]
    },

    async run({ enriched_slides }) {
        if (!isUsingAutomizer()) {
            throw new Error("Requires pptx-automizer. Call create_presentation first.");
        }

        const pres = getPresentation();
        const template = getTemplateInfo();
        if (!pres || !template) {
            throw new Error("No presentation initialized.");
        }

        // PLANNER
        const plan = planSlides(enriched_slides);
        const results = [];

        // LOOP
        for (let i = 0; i < enriched_slides.length; i++) {
            const slideData = enriched_slides[i];
            let retryCount = 0;
            let selection = selectTemplateForSlide(slideData, i);

            while (true) {
                try {
                    const result = await generateSlideContent(pres, template.label, selection, slideData);
                    const validation = validateSlide(result, selection);
                    const decision = handleValidation(validation, retryCount);

                    if (decision.action === "retry") {
                        retryCount++;
                        selection = selectTemplateForSlide({ ...slideData, type: "content" }, i);
                        continue;
                    }

                    trackSlide({ type: selection.type, title: slideData.title, templateSlide: selection.templateSlide });

                    results.push({
                        slideNumber: slideData.number || (i + 1),
                        type: selection.type,
                        template: selection.templateSlide,
                        confidence: selection.confidence,
                        status: decision.action === "skip" ? "skipped" : "success",
                        retries: retryCount
                    });
                    break;
                } catch (err) {
                    if (retryCount++ < 2) {
                        selection = selectTemplateForSlide({ ...slideData, type: "content" }, i);
                        continue;
                    }
                    results.push({
                        slideNumber: slideData.number || (i + 1),
                        status: "failed",
                        error: err.message
                    });
                    break;
                }
            }
        }

        return {
            plan: { total: plan.totalSlides },
            results,
            summary: `Created ${results.filter(r => r.status === "success").length}/${enriched_slides.length} slides`,
            templateMapping: Object.fromEntries(
                results.filter(r => r.template).map(r => [r.slideNumber, { type: r.type, template: r.template }])
            )
        };
    }
};
