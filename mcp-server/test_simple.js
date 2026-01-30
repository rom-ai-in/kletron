/**
 * Simple test for slide loop with known working placeholders
 */
import { Automizer } from 'pptx-automizer';
import fs from 'fs/promises';

async function simpleTest() {
    console.log('Simple slide loop test with known placeholders...\n');

    const automizer = new Automizer({
        templateDir: '/Users/romainmagnin/Desktop/payroll-working-folder/PowerPoint',
        outputDir: '/Users/romainmagnin/Desktop/payroll-working-folder',
        autoImportSlideMasters: true,
        removeExistingSlides: true,
        verbosity: 0
    });

    const pres = automizer.loadRoot('ForvisMazars_Template_BLANK_012026.potx');
    pres.load('ForvisMazars_Template_BLANK_012026.potx', 'template');

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

    // Slide 3 - Title slide (has Title 1 + Subtitle 2)
    console.log('Adding Cover slide (template 3)...');
    pres.addSlide('template', 3, (s) => {
        s.modifyElement('Title 1', (el) => injectText(el, 'Proposal for Salesforce'));
        s.modifyElement('Subtitle 2', (el) => injectText(el, 'Payroll Services - 2026'));
    });

    // Slide 7 - Content slide (has Title 1 + Text Placeholder 2)
    console.log('Adding Content slide (template 7)...');
    pres.addSlide('template', 7, (s) => {
        s.modifyElement('Title 1', (el) => injectText(el, 'Executive Summary'));
        s.modifyElement('Text Placeholder 2', (el) => injectText(el, '• Salesforce Switzerland\n• 1500 employees\n• Based in Lausanne'));
    });

    // Slide 5 - Section divider (has Title 1 + Subtitle 2)  
    console.log('Adding Section slide (template 5)...');
    pres.addSlide('template', 5, (s) => {
        s.modifyElement('Title 1', (el) => injectText(el, 'Our Approach'));
        s.modifyElement('Subtitle 2', (el) => injectText(el, 'How we deliver value'));
    });

    // Another content slide
    console.log('Adding Content slide 2 (template 7)...');
    pres.addSlide('template', 7, (s) => {
        s.modifyElement('Title 1', (el) => injectText(el, 'Key Benefits'));
        s.modifyElement('Text Placeholder 2', (el) => injectText(el, '• Compliance guaranteed\n• Swiss expertise\n• 24/7 support'));
    });

    console.log('\nWriting presentation...');
    await pres.write('Test_SimpleLoop.pptx');

    try {
        await fs.rename(
            '/Users/romainmagnin/Desktop/payroll-working-folder/Test_SimpleLoop.pptx',
            '/Users/romainmagnin/Desktop/payroll-working-folder/Outputs/Test_SimpleLoop.pptx'
        );
    } catch {
        await fs.copyFile(
            '/Users/romainmagnin/Desktop/payroll-working-folder/Test_SimpleLoop.pptx',
            '/Users/romainmagnin/Desktop/payroll-working-folder/Outputs/Test_SimpleLoop.pptx'
        );
    }

    console.log('✅ Saved to Outputs/Test_SimpleLoop.pptx');
}

simpleTest().catch(err => console.error('ERROR:', err));
