/**
 * Test script for slideLoopController
 */
import { Automizer } from 'pptx-automizer';
import fs from 'fs/promises';

// Mock the presentationState for testing
const mockState = {
    automizer: null,
    template: null,
    slides: []
};

// Simple inline test of the logic
async function testSlideLoop() {
    console.log('Testing slideLoopController logic...\n');

    // Sample enriched slides from agent
    const enrichedSlides = [
        { number: 1, title: "Proposal for Salesforce Switzerland", type: "title", subtitle: "Compliance-enabled Payroll Services - January 2026" },
        { number: 2, title: "Agenda", type: "content", key_points: ["Introduction", "Our Services", "Why Choose Us", "Pricing", "Next Steps"] },
        { number: 3, title: "Our Understanding of Your Needs", type: "section", subtitle: "What we heard from you" },
        { number: 4, title: "Executive Summary", type: "content", key_points: ["Salesforce Switzerland with 1,500 employees", "Legal seat in Lausanne", "Growing rapidly"] },
        { number: 5, title: "Proposed Timeline", type: "table", key_points: ["Q1: Onboarding", "Q2: Implementation", "Q3: Go-Live"] },
        { number: 6, title: "Next Steps & Contact", type: "thankyou", subtitle: "Thank you for your consideration" }
    ];

    // Template mapping logic (same as in tool)
    const TEMPLATE_MAPPING = {
        "title": { slideNumber: 3, description: "Cover page" },
        "cover": { slideNumber: 3, description: "Cover page" },
        "section": { slideNumber: 5, description: "Section divider" },
        "divider": { slideNumber: 5, description: "Section divider" },
        "content": { slideNumber: 7, description: "Content with bullets" },
        "bullets": { slideNumber: 7, description: "Content with bullets" },
        "table": { slideNumber: 11, description: "Table layout" },
        "thankyou": { slideNumber: 20, description: "Closing slide" },
    };

    // Detect type function
    function detectSlideType(slide) {
        const type = (slide.type || "").toLowerCase();
        if (type && TEMPLATE_MAPPING[type]) return type;
        return "content";  // default
    }

    console.log('=== Template Selection Test ===\n');

    for (const slide of enrichedSlides) {
        const detectedType = detectSlideType(slide);
        const template = TEMPLATE_MAPPING[detectedType];
        console.log(`Slide ${slide.number}: "${slide.title}"`);
        console.log(`  → Type: ${detectedType}`);
        console.log(`  → Template: Slide ${template.slideNumber} (${template.description})`);
        console.log('');
    }

    console.log('=== Creating actual presentation ===\n');

    // Create real presentation using automizer
    const automizer = new Automizer({
        templateDir: '/Users/romainmagnin/Desktop/payroll-working-folder/PowerPoint',
        outputDir: '/Users/romainmagnin/Desktop/payroll-working-folder',
        autoImportSlideMasters: true,
        removeExistingSlides: true,
        verbosity: 0
    });

    const pres = automizer.loadRoot('ForvisMazars_Template_BLANK_012026.potx');
    pres.load('ForvisMazars_Template_BLANK_012026.potx', 'template');

    // Helper function
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
        if (endParaRPr) {
            paragraph.insertBefore(aR, endParaRPr);
        } else {
            paragraph.appendChild(aR);
        }
        return true;
    };

    // Create each slide
    for (const slide of enrichedSlides) {
        const detectedType = detectSlideType(slide);
        const templateConfig = TEMPLATE_MAPPING[detectedType];

        console.log(`Creating slide ${slide.number}: ${slide.title} → Template ${templateConfig.slideNumber}`);

        pres.addSlide('template', templateConfig.slideNumber, (s) => {
            // Inject title - only try the first one that works
            try { s.modifyElement('Title 1', (el) => injectText(el, slide.title)); } catch { }

            // Inject content
            const content = slide.key_points ? slide.key_points.map(p => `• ${p}`).join('\n') : slide.subtitle;
            if (content) {
                // Try different placeholders - each in separate try/catch
                try { s.modifyElement('Text Placeholder 2', (el) => injectText(el, content)); } catch { }
                try { s.modifyElement('Subtitle 2', (el) => injectText(el, content)); } catch { }
            }
        });
    }

    console.log('\nWriting presentation...');
    await pres.write('Test_SlideLoop.pptx');

    // Move to Outputs
    const source = '/Users/romainmagnin/Desktop/payroll-working-folder/Test_SlideLoop.pptx';
    const dest = '/Users/romainmagnin/Desktop/payroll-working-folder/Outputs/Test_SlideLoop.pptx';
    try {
        await fs.rename(source, dest);
    } catch {
        await fs.copyFile(source, dest);
        await fs.unlink(source);
    }

    console.log('\n✅ Saved to: ' + dest);
    console.log('\nPlease open this file to verify:');
    console.log('- Slide 1 (title) uses template 3');
    console.log('- Slide 2 (content) uses template 7');
    console.log('- Slide 3 (section) uses template 5');
    console.log('- Slide 4 (content) uses template 7');
    console.log('- Slide 5 (table) uses template 11');
    console.log('- Slide 6 (thankyou) uses template 20');
}

testSlideLoop().catch(err => console.error('ERROR:', err));
