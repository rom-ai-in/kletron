import fetch from 'cross-fetch';

const BASE_URL = 'http://localhost:3000/api/editor';

async function demo() {
    console.log('Populating Editor State for Badge Demo...\n');

    const testFile1 = '/Users/romainmagnin/Desktop/numezis-coder-mcp/src/components/FileTree.tsx';
    const testFile2 = '/Users/romainmagnin/Desktop/numezis-coder-mcp/src/components/EditorPage.tsx';

    // Scenario 1: Agent working on FileTree.tsx (blue badge)
    console.log('1. Agent claiming FileTree.tsx...');
    await fetch(`${BASE_URL}/agents/drift-worker/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: testFile1 })
    });

    // Scenario 2: Diff on EditorPage.tsx (amber badge)
    console.log('2. Proposing diff for EditorPage.tsx...');
    await fetch(`${BASE_URL}/agents/test-agent/diff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fileId: testFile2,
            chunks: [{ startLine: 1, endLine: 1, replacementContent: ['// Test comment'] }]
        })
    });

    // Scenario 3: Conflicting diff (red badge)
    console.log('3. Creating conflict on EditorPage.tsx...');
    await fetch(`${BASE_URL}/agents/conflict-agent/diff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fileId: testFile2,
            chunks: [{ startLine: 1, endLine: 1, replacementContent: ['// Conflict'] }]
        })
    });

    console.log('\n✅ Demo data populated!');
    console.log('Check the file tree - you should see:');
    console.log('  - Blue dot on FileTree.tsx (active agent)');
    console.log('  - Red dot on EditorPage.tsx (conflict)');
    console.log('  - Green dot on currently selected file');
}

demo();
