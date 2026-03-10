#!/bin/bash
set -e

echo "=== Debugging Workspace Loading ==="
echo ""

# Check if MongoDB is running
echo "1. Checking MongoDB connection..."
if ! command -v mongosh &> /dev/null; then
    echo "❌ mongosh not found"
else
    echo "✓ mongosh available"
fi

echo ""
echo "2. Checking workspaces collection..."
MONGODB_URI="mongodb://localhost:27017/numezis_coder" npm run db-shell -- --eval '
  const workspaces = await db.workspaces.find({}).toArray();
  console.log("Total workspaces:", workspaces.length);
  workspaces.forEach((w, i) => {
    console.log(`Workspace ${i}:`, JSON.stringify({
      id: w._id?.toString(),
      name: w.name,
      rootPath: w.rootPath,
      ownerId: w.ownerId,
      status: w.status
    }, null, 2));
  });
' || echo "⚠️ Could not connect to DB"

echo ""
echo "3. Checking workspace_state collection..."
MONGODB_URI="mongodb://localhost:27017/numezis_coder" npm run db-shell -- --eval '
  const state = await db.workspace_state.find({}).toArray();
  console.log("State documents:", state.length);
  state.forEach((s, i) => {
    console.log(`State ${i}:`, JSON.stringify({
      _id: s._id,
      activeWorkspaceId: s.activeWorkspaceId?.toString(),
      updatedAt: s.updatedAt
    }, null, 2));
  });
' || echo "⚠️ Could not connect to DB"

echo ""
echo "4. Checking workspace_configs collection..."
MONGODB_URI="mongodb://localhost:27017/numezis_coder" npm run db-shell -- --eval '
  const configs = await db.workspace_configs.find({}).toArray();
  console.log("Config documents:", configs.length);
  configs.forEach((c, i) => {
    console.log(`Config ${i}:`, JSON.stringify({
      _id: c._id,
      workingFolder: c.workingFolder
    }, null, 2));
  });
' || echo "⚠️ Could not connect to DB"

echo ""
echo "5. Testing workspace service directly..."
node -e "
  const { listWorkspaces, getActiveWorkspace } = require('./packages/server/src/services/workspaceService');
  (async () => {
    try {
      const workspaces = await listWorkspaces('test-owner-id');
      console.log('listWorkspaces result:', JSON.stringify(workspaces.map(w => ({
        id: w._id?.toString(),
        name: w.name,
        rootPath: w.rootPath
      })), null, 2));

      const active = await getActiveWorkspace('test-owner-id');
      console.log('getActiveWorkspace result:', JSON.stringify({
        id: active?._id?.toString(),
        name: active?.name,
        rootPath: active?.rootPath
      }, null, 2));
    } catch (e) {
      console.error('Error:', e.message);
    }
  })();
"