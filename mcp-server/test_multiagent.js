/**
 * Test for multi-agent slide loop with corrected template mappings
 */
import { Automizer } from 'pptx-automizer';
import fs from 'fs/promises';

const TEMPLATE_CONFIG = {
    "title": { slideNumber: 3, placeholders: { title: "Title 1", subtitle: "Subtitle 2" } },
    "section": { slideNumber: 4, placeholders: { title: "Title 1", subtitle: "Subtitle 2" } },
    "content": { slideNumber: 7, placeholders: { title: "Title 1", content: "Text Placeholder 2" } },
    "thankyou": { slideNumber: 3, placeholders: { title: "Title 1", subtitle: "Subtitle 2" } }
};

function selectTemplate(slideData, index) {
    const type = (slideData.type || "").toLowerCase();
    if (type && TEMPLATE_CONFIG[type]) return { type, ...TEMPLATE_CONFIG[type] };
    if (index === 0) return { type: "title", ...TEMPLATE_CONFIG["title"] };
    return { type: "content", ...TEMPLATE_CONFIG["content"] };
}

const injectText = (element, text) => {
    const txBody = element.getElementsByTagName('p:txBody')[0];
    if (!txBody) return;
    const paragraph = txBody.getElementsByTagName('a:p')[0];
    if (!paragraph) return;
    const existingRuns = paragraph.getElementsByTagName('a:r');
    while (existingRuns.length > 0) existingRuns[0].parentNode.removeChild(existingRuns[0]);
    const doc = element.ownerDocument;
    const aR = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:r');
    const aT = doc.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:t');
    aT.textContent = text;
    aR.appendChild(aT);
    const endParaRPr = paragraph.getElementsByTagName('a:endParaRPr')[0];
    if (endParaRPr) paragraph.insertBefore(aR, endParaRPr);
    else paragraph.appendChild(aR);
};

async function test() {
    console.log('=== Multi-Agent Slide Loop Test (Fixed) ===\n');

    const slides = [
        { number: 1, title: "Proposal for Salesforce", type: "title", subtitle: "Payroll Services 2026" },
        { number: 2, title: "Agenda", type: "content", key_points: ["Intro", "Services", "Pricing"] },
        { number: 3, title: "Our Approach", type: "section", subtitle: "How we work" },
        { number: 4, title: "Benefits", type: "content", key_points: ["Compliance", "Swiss expertise"] },
        { number: 5, title: "Thank You", type: "thankyou", subtitle: "Contact us" }
    ];

    console.log('TEMPLATE SELECTION:');
    slides.forEach((s, i) => {
        const sel = selectTemplate(s, i);
        console.log(`  Slide ${i + 1}: "${s.title}" → Template ${sel.slideNumber} (${sel.type})`);
    });
    console.log('');

    const automizer = new Automizer({
        templateDir: '/Users/romainmagnin/Desktop/payroll-working-folder/PowerPoint',
        outputDir: '/Users/romainmagnin/Desktop/payroll-working-folder',
        autoImportSlideMasters: true,
        removeExistingSlides: true,
        verbosity: 0
    });

    const pres = automizer.loadRoot('ForvisMazars_Template_BLANK_012026.potx');
    pres.load('ForvisMazars_Template_BLANK_012026.potx', 'template');

    console.log('GENERATING SLIDES:');
    for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        const sel = selectTemplate(slide, i);
        console.log(`  Creating slide ${i + 1}...`);

        pres.addSlide('template', sel.slideNumber, (s) => {
            s.modifyElement(sel.placeholders.title, (el) => injectText(el, slide.title));
            const text = slide.key_points ? slide.key_points.map(p => `• ${p}`).join('\n') : slide.subtitle;
            const ph = sel.placeholders.content || sel.placeholders.subtitle;
            if (text && ph) s.modifyElement(ph, (el) => injectText(el, text));
        });
    }
    console.log('');

    console.log('SAVING...');
    await pres.write('Test_Fixed_Loop.pptx');

    const src = '/Users/romainmagnin/Desktop/payroll-working-folder/Test_Fixed_Loop.pptx';
    const dst = '/Users/romainmagnin/Desktop/payroll-working-folder/Outputs/Test_Fixed_Loop.pptx';
    try { await fs.rename(src, dst); } catch { await fs.copyFile(src, dst); await fs.unlink(src); }

    console.log(`✅ Saved: ${dst}\n`);
    console.log('VERIFY IN POWERPOINT:');
    console.log('  Slide 1: Template 3 (Title)');
    console.log('  Slide 2: Template 7 (Content)');
    console.log('  Slide 3: Template 4 (Section)');
    console.log('  Slide 4: Template 7 (Content)');
    console.log('  Slide 5: Template 3 (Thank You)');
}

test().catch(console.error);
