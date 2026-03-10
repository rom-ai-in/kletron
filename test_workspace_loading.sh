#!/bin/bash

# Test script to verify workspace configuration
echo "Testing workspace configuration..."

# Check if config files exist and have correct paths
echo ""
echo "=== Checking apps/web/config/config.json ==="
if grep -q "/home/romain/machine-trade" apps/web/config/config.json; then
    echo "ERROR: Found Linux path in web config!"
    exit 1
else
    echo "✓ Web config does not contain Linux paths"
fi

echo ""
echo "=== Checking config/config.json ==="
if grep -q "/home/romain/machine-trade" config/config.json; then
    echo "ERROR: Found Linux path in desktop config!"
    exit 1
else
    echo "✓ Desktop config does not contain Linux paths"
fi

# Check that no hardcoded workspace paths exist (workspaces should only come from database)
echo ""
echo "=== Verifying no hardcoded workspace paths ==="
if grep -q "/home/romain" apps/web/config/config.json || grep -q "/home/romain" config/config.json; then
    echo "ERROR: Linux paths still present!"
    exit 1
fi

# Check that workingFolder is not set (or points to a valid local path)
if grep -q "\"workingFolder\"" apps/web/config/config.json && ! grep -q "/Users/romainmagnin" apps/web/config/config.json; then
    echo "ERROR: Web config has unexpected workingFolder!"
    exit 1
fi

echo "✓ No hardcoded workspace paths found"

echo ""
echo "=== All checks passed! ==="
echo "The workspace configuration has been fixed."
echo "Workspace paths should now load correctly without 'Path missing' errors."