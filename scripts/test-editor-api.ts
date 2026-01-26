import fetch from 'cross-fetch';

const BASE_URL = 'http://localhost:3000/api/editor';

async function test() {
    console.log('Starting Multi-Agent Editor API Test...');

    const agent1 = 'agent-001';
    const agent2 = 'agent-002';
    const fileId = '/tmp/test-file.ts';

    try {
        // 1. Claim File
        console.log(`\n[Agent 1] Claiming ${fileId}...`);
        const res1 = await fetch(`${BASE_URL}/agents/${agent1}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId })
        });
        if (!res1.ok) throw new Error(`Claim failed: ${res1.status}`);
        console.log('Claim successful');

        // 2. Cursor Update
        console.log(`\n[Agent 1] Updating cursor...`);
        const res2 = await fetch(`${BASE_URL}/agents/${agent1}/cursor`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId, position: { line: 10, column: 5 } })
        });
        if (!res2.ok) throw new Error(`Cursor update failed: ${res2.status}`);
        console.log('Cursor updated');

        // 3. Diff Proposal (No Conflict)
        console.log(`\n[Agent 1] Proposing diff...`);
        const res3 = await fetch(`${BASE_URL}/agents/${agent1}/diff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileId,
                chunks: [{ startLine: 1, endLine: 1, replacementContent: ['// New Header'] }]
            })
        });
        const diff1 = await res3.json();
        console.log('Diff proposed:', diff1);

        // 4. Diff Proposal (Conflict)
        console.log(`\n[Agent 2] Proposing conflicting diff...`);
        const res4 = await fetch(`${BASE_URL}/agents/${agent2}/diff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileId,
                chunks: [{ startLine: 1, endLine: 1, replacementContent: ['// Conflicting Header'] }]
            })
        });
        const diff2 = await res4.json();
        console.log('Diff proposed (should conflict):', diff2);

        if (diff2.conflict) {
            console.log('SUCCESS: Conflict correctly detected.');
        } else {
            console.error('FAILURE: Conflict NOT detected.');
        }

    } catch (e) {
        console.error('Test Failed:', e);
    }
}

test();
