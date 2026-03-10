#!/bin/bash

echo "=== Checking MongoDB for workspaces ==="
echo ""

echo "1. Checking workspaces collection..."
mongosh "mongodb://localhost:27017/numezis_coder" --eval '
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
echo "2. Checking workspace_state collection..."
mongosh "mongodb://localhost:27017/numezis_coder" --eval '
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
echo "3. Checking workspace_configs collection..."
mongosh "mongodb://localhost:27017/numezis_coder" --eval '
  const configs = await db.workspace_configs.find({}).toArray();
  console.log("Config documents:", configs.length);
  configs.forEach((c, i) => {
    console.log(`Config ${i}:`, JSON.stringify({
      _id: c._id,
      workingFolder: c.workingFolder
    }, null, 2));
  });
' || echo "⚠️ Could not connect to DB"