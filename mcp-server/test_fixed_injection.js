/**
 * Test script for the fixed direct XML injection approach
 */
import { Automizer } from 'pptx-automizer';
import fs from 'fs/promises';
import path from 'path';

async function testFix() {
    console.log('Testing the fixed direct XML injection approach...');

    const automizer = new Automizer({
        templateDir: '/Users/romainmagnin/Desktop/payroll-working-folder/PowerPoint',
        outputDir: '/Users/romainmagnin/Desktop/payroll-working-folder',
        autoImportSlideMasters: true,
        removeExistingSlides: true,
        verbosity: 0
    });

    const pres = automizer.loadRoot('ForvisMazars_Template_BLANK_012026.potx');
    pres.load('ForvisMazars_Template_BLANK_012026.potx', 'template');

    // Helper function (same as in addTitleSlide.js and addContentSlide.js)
    const injectText = (element, text) => {
        const txBody = element.getElementsByTagName('p:txBody')[0];
        if (!txBody) {
            console.log('  No txBody found');
            return false;
        }

        const paragraph = txBody.getElementsByTagName('a:p')[0];
        if (!paragraph) {
            console.log('  No paragraph found');
            return false;
        }

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
        console.log('  ✅ Text injected');
        return true;
    };

    // Test Title Slide (slide 3)
    console.log('\n=== Adding title slide (slide 3) ===');
    pres.addSlide('template', 3, (slide) => {
        console.log('Modifying Title 1...');
        slide.modifyElement('Title 1', (el) => injectText(el, 'Proposal for Salesforce Switzerland'));
        console.log('Modifying Subtitle 2...');
        slide.modifyElement('Subtitle 2', (el) => injectText(el, 'Compliance-enabled Payroll Services - January 2026'));
    });

    // Test Content Slide (slide 7)
    console.log('\n=== Adding content slide (slide 7) ===');
    pres.addSlide('template', 7, (slide) => {
        console.log('Modifying Title 1...');
        slide.modifyElement('Title 1', (el) => injectText(el, 'Executive Summary'));
        console.log('Modifying Text Placeholder 2...');
        slide.modifyElement('Text Placeholder 2', (el) => injectText(el, '• Salesforce Switzerland: Legal seat in Lausanne\n• Branch office in Zurich\n• Enterprise software leader with 70,000+ employees globally\n• Focus on data and AI capabilities'));
    });

    // Write
    console.log('\n=== Writing presentation ===');
    const filename = 'Test_Fixed_Injection.pptx';
    await pres.write(filename);

    // Move to Outputs
    const source = '/Users/romainmagnin/Desktop/payroll-working-folder/' + filename;
    const dest = '/Users/romainmagnin/Desktop/payroll-working-folder/Outputs/' + filename;
    try {
        await fs.rename(source, dest);
    } catch (e) {
        await fs.copyFile(source, dest);
        await fs.unlink(source);
    }

    console.log('\n✅ Saved to: ' + dest);
}

testFix().catch(err => console.error('ERROR:', err));
