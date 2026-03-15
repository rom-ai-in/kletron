import { normalizeMarkdown } from '../src/utils/markdown/normalizer';

async function testNormalizer() {
    const dirtyMarkdown = `
# Title
---
- item 1
* item 2
+ item 3

Paragraph with a soft
linebreak.

\`\`\`
const x = 1;
\`\`\`
    `;

    console.log("Input:\n", dirtyMarkdown);
    console.log("\n=====================\n");
    const cleanMarkdown = await normalizeMarkdown(dirtyMarkdown);
    console.log("Output:\n", cleanMarkdown);
}

testNormalizer().catch(console.error);
