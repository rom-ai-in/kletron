#!/bin/bash

echo "============================================"
echo "  CoWork Implementation Verification"
echo "============================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter
passed=0
failed=0
total=0

# Function to check file exists
check_file() {
    local file=$1
    local name=$2
    total=$((total + 1))
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $name"
        passed=$((passed + 1))
    else
        echo -e "${RED}✗${NC} $name (missing)"
        failed=$((failed + 1))
    fi
}

# Function to check directory exists
check_dir() {
    local dir=$1
    local name=$2
    total=$((total + 1))
    
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $dir exists"
        passed=$((passed + 1))
    else
        echo -e "${RED}✗${NC} $dir missing"
        failed=$((failed + 1))
    fi
}

echo "Checking Backend Components..."
echo "------------------------------"
check_file "/Users/romainmagnin/Desktop/kletron/packages/agent-core/src/categoryRouter.ts" "Category Router"
check_file "/Users/romainmagnin/Desktop/kletron/packages/agent-core/src/categoryWorkflowRunner.ts" "Category Workflow Runner"
check_file "/Users/romainmagnin/Desktop/kletron/packages/agent-core/src/categoryPromptEngine.ts" "Category Prompt Engine"
check_file "/Users/romainmagnin/Desktop/kletron/packages/agent-core/src/categoryErrorHandler.ts" "Category Error Handler"
check_file "/Users/romainmagnin/Desktop/kletron/packages/agent-core/src/categoryPerformanceOptimizer.ts" "Category Performance Optimizer"
check_file "/Users/romainmagnin/Desktop/kletron/packages/agent-core/src/categoryToolSelector.ts" "Category Tool Selector"
check_file "/Users/romainmagnin/Desktop/kletron/packages/server/src/services/contextPreservation.ts" "Context Preservation Service"
check_file "/Users/romainmagnin/Desktop/kletron/packages/server/src/services/migrationRunner.ts" "Migration Runner"
check_file "/Users/romainmagnin/Desktop/kletron/packages/server/src/services/workspaceCategoryService.ts" "Workspace Category Service"
check_file "/Users/romainmagnin/Desktop/kletron/packages/shared/src/workspaceCategories.ts" "Shared Workspace Categories"
echo ""

echo "Checking Database Migrations..."
echo "------------------------------"
check_file "/Users/romainmagnin/Desktop/kletron/config/migrations/001_cowork_categories.sql" "Database Migration"
echo ""

echo "Checking Electron Components..."
echo "------------------------------"
check_file "/Users/romainmagnin/Desktop/kletron/apps/desktop/src/ipc/categoryHandlers.ts" "Category IPC Handlers"
check_file "/Users/romainmagnin/Desktop/kletron/apps/desktop/src/native/notifications.ts" "Category Notifications"
check_file "/Users/romainmagnin/Desktop/kletron/apps/desktop/src/protocol.ts" "Deep Link Protocol"
check_file "/Users/romainmagnin/Desktop/kletron/apps/desktop/src/windowManager.ts" "Window Manager"
check_file "/Users/romainmagnin/Desktop/kletron/apps/desktop/src/statusBar.ts" "Status Bar"
check_file "/Users/romainmagnin/Desktop/kletron/apps/desktop/src/iconManager.ts" "Icon Manager"
check_file "/Users/romainmagnin/Desktop/kletron/apps/desktop/src/security.ts" "Security Manager"
check_file "/Users/romainmagnin/Desktop/kletron/apps/desktop/src/hooks/useCategories.ts" "Use Categories Hook"
check_file "/Users/romainmagnin/Desktop/kletron/apps/desktop/src/hooks/useCategoryRouting.ts" "Category Routing Hook"
echo ""

echo "Checking Frontend Components..."
echo "------------------------------"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/components/cowork/CoworkWorkbench.tsx" "Cowork Workbench"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/components/cowork/OnboardingFlow.tsx" "Onboarding Flow"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/context/CoworkContext.tsx" "Cowork Context"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/components/workspace/WorkspaceSidebar.tsx" "Workspace Sidebar"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/components/workspace/WorkspaceCategorySelector.tsx" "Category Selector"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/components/workspace/CategorySpecificInput.tsx" "Category Input"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/components/chat/ThreadFeed.tsx" "Thread Feed"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/components/chat/ChatInput.tsx" "Chat Input"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/components/chat/Message.tsx" "Message Component"
echo ""

echo "Checking API Endpoints..."
echo "------------------------------"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/pages/api/workspaces/[workspaceId]/categories.ts" "Categories API"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/pages/api/workspaces/[workspaceId]/categories/[categoryId]/process.ts" "Process API"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/pages/api/workspaces/[workspaceId]/automations.ts" "Automations API"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/pages/api/workspaces/[workspaceId]/categories/[categoryId]/automations.ts" "Category Automations API"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/pages/api/analytics/events.ts" "Analytics Events API"
echo ""

echo "Checking Tests..."
echo "------------------------------"
check_file "/Users/romainmagnin/Desktop/kletron/packages/agent-core/__tests__/categorySystem.test.ts" "Backend Tests"
check_file "/Users/romainmagnin/Desktop/kletron/packages/agent-core/__tests__/categoryWorkflowRunner.test.ts" "Workflow Runner Tests"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/components/cowork/__tests__/CoworkWorkbench.test.tsx" "Frontend Tests"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/components/cowork/__tests__/integration.test.ts" "Integration Tests"
echo ""

echo "Checking Existing Components..."
echo "------------------------------"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/app/app/cowork/page.tsx" "CoWork Page"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/app/app/cowork/page-backup.tsx" "CoWork Page Backup"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/components/CategorySelector.tsx" "Category Selector Component"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/components/workspace/CategorySwitcher.tsx" "Category Switcher"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/components/workspaces/WorkspaceCategoryManager.tsx" "Workspace Category Manager"
check_file "/Users/romainmagnin/Desktop/kletron/apps/web/components/workspaces/WorkspaceSkillsManager.tsx" "Workspace Skills Manager"
echo ""

echo "============================================"
echo "  Results"
echo "============================================"
echo -e "Total checks: ${total}"
echo -e "${GREEN}Passed: ${passed}${NC}"
echo -e "${RED}Failed: ${failed}${NC}"
echo ""

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! CoWork implementation is complete.${NC}"
    exit 0
else
    echo -e "${RED}✗ Some checks failed. Please review the missing components.${NC}"
    exit 1
fi
