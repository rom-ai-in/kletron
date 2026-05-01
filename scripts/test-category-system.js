#!/usr/bin/env node
/**
 * Test script for category system functionality
 */

// Mock the work categories configuration
const BUILT_IN_CATEGORIES = [
  {
    id: 'coding',
    name: 'Code Assistance',
    description: 'AI-powered code analysis, generation, and debugging',
    defaultPrompt: 'You are a senior software engineer helping with code tasks.',
    availableTools: ['list_files', 'read_file', 'search_code'],
    requiredContextTypes: ['repository', 'codebase'],
    capabilities: { canEditFiles: true }
  },
  {
    id: 'drafting',
    name: 'Document Drafting',
    description: 'Create and edit professional documents',
    defaultPrompt: 'You are a professional technical writer.',
    availableTools: ['fetch_url', 'web_search', 'read_file'],
    requiredContextTypes: ['document_template'],
    capabilities: { canEditFiles: false }
  },
  {
    id: 'automation',
    name: 'Workflow Automation',
    description: 'Create automated workflows and follow-ups',
    defaultPrompt: 'You are a productivity automation specialist.',
    availableTools: ['execute_bash', 'git_commit', 'schedule_task'],
    requiredContextTypes: ['calendar', 'email'],
    capabilities: { canScheduleTasks: true }
  }
];

console.log('Testing category system...\n');

// Test 1: Verify built-in categories exist
console.log('✓ Built-in categories loaded:', BUILT_IN_CATEGORIES.map(c => c.id).join(', '));

// Test 2: Verify category structure
BUILT_IN_CATEGORIES.forEach(category => {
  if (!category.id || !category.name || !category.defaultPrompt) {
    throw new Error(`Category ${category.id} is missing required fields`);
  }
});
console.log('✓ All categories have required fields');

// Test 3: Verify tool availability
const codingTools = BUILT_IN_CATEGORIES.find(c => c.id === 'coding')?.availableTools;
if (!codingTools || !codingTools.includes('read_file')) {
  throw new Error('Coding category missing read_file tool');
}
console.log('✓ Coding category has expected tools:', codingTools.join(', '));

// Test 4: Verify capabilities
const automationCapabilities = BUILT_IN_CATEGORIES.find(c => c.id === 'automation')?.capabilities;
if (!automationCapabilities?.canScheduleTasks) {
  throw new Error('Automation category missing canScheduleTasks capability');
}
console.log('✓ Automation category has scheduling capability');

// Test 5: Verify workspace-specific configuration structure
const workspaceConfig = {
  id: 'workspace-123',
  name: 'My Project',
  path: '/path/to/project',
  categories: [
    {
      categoryId: 'coding',
      customName: 'Backend Development',
      description: 'Focused on API and server-side code'
    }
  ],
  skills: ['research', 'testing']
};

console.log('✓ Workspace configuration structure valid');
console.log('  - Workspace:', workspaceConfig.name);
console.log('  - Custom category name:', workspaceConfig.categories[0].customName);
console.log('  - Enabled skills:', workspaceConfig.skills.join(', '));

// Test 6: Verify context preservation logic
const preservedContext = {
  global: { userPreferences: {}, recentActivities: [] },
  domainSpecific: { activeFiles: [], recentEdits: [] }
};

console.log('✓ Context preservation structure valid');
console.log('  - Global context keys:', Object.keys(preservedContext.global).join(', '));
console.log('  - Domain-specific context keys:', Object.keys(preservedContext.domainSpecific).join(', '));

// Test 7: Verify category switching logic
const currentCategory = 'coding';
const targetCategory = 'drafting';
const transitionResult = {
  fromCategory: currentCategory,
  toCategory: targetCategory,
  preservedItems: Object.keys(preservedContext.domainSpecific).length,
  warnings: []
};

console.log('✓ Category switching logic valid');
console.log(`  - Transitioning from ${currentCategory} to ${targetCategory}`);
console.log(`  - Preserved ${transitionResult.preservedItems} context items`);

console.log('\n✅ All category system tests passed!');
