// Test script to verify workspace listing works correctly
const { listWorkspaces } = require('./packages/server/src/services/workspaceService.ts');

(async () => {
  try {
    console.log('Testing workspace listing...');
    const workspaces = await listWorkspaces('test-owner');
    console.log(`✓ Successfully listed ${workspaces.length} workspaces`);
    if (workspaces.length > 0) {
      console.log('\nWorkspace details:');
      workspaces.forEach((ws, i) => {
        console.log(`${i + 1}. ${ws.name}`);
        console.log(`   Path: ${ws.rootPath}`);
        console.log(`   Status: ${ws.status}`);
        console.log(`   Created: ${ws.createdAt}`);
      });
    } else {
      console.log('No workspaces found (this is expected if no workspaces exist for test-owner)');
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
})();