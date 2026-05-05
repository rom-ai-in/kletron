// scripts/test-api-routes.ts
import 'dotenv/config';

import { categoryService } from '@kletron/server/services/categoryService';
import type { WorkCategoryConfig } from '@kletron/shared/categoryTypes';
import { ObjectId } from 'mongodb';

console.log('🧪 Testing Category System API Routes...\n');

// Test 1: Get all categories
try {
  console.log('✓ Test 1: Getting all built-in categories...');
  const categories = await categoryService.getAllCategories();
  if (!categories || !Array.isArray(categories)) {
    throw new Error('No categories returned');
  }
  console.log(`  Found ${categories.length} categories:`);
  categories.forEach((cat: WorkCategoryConfig) => {
    console.log(`  - ${cat.id}: ${cat.name}`);
  });
  console.log('✅ Test 1 passed\n');
} catch (error) {
  console.error('❌ Test 1 failed:', error, '\n');
}

// Test 2: Set and get current category
try {
  console.log('✓ Test 2: Setting and getting current category...');
  const testUserId = 'test-user-123';
  
  await categoryService.setCurrentCategory(testUserId, 'coding');
  const result = await categoryService.getCurrentCategory(testUserId);
  
  if (result === 'coding') {
    console.log(`  Current category set to: ${result}`);
    console.log('✅ Test 2 passed\n');
  } else {
    console.log(`  Result: ${JSON.stringify(result)}`);
    throw new Error('Current category not set correctly');
  }
} catch (error) {
  console.error('❌ Test 2 failed:', error, '\n');
}

// Test 3: Create workspace-specific category
try {
  console.log('✓ Test 3: Creating workspace-specific category...');
  const testWorkspaceId = new ObjectId(); // Use proper ObjectId
  
  const customCategory = await categoryService.createWorkspaceCategory(
    testWorkspaceId.toString(),
    'coding',
    {
      customName: 'My Custom Coding',
      description: 'Custom coding setup for this workspace'
    }
  );
  
  console.log(`  Created: ${customCategory.customName}`);
  console.log('✅ Test 3 passed\n');
} catch (error) {
  console.error('❌ Test 3 failed:', error, '\n');
}

// Test 4: Get workspace categories
try {
  console.log('✓ Test 4: Getting workspace-specific categories...');
  const testWorkspaceId = new ObjectId(); // Use proper ObjectId
  
  const workspaceCategories = await categoryService.getWorkspaceCategories(testWorkspaceId.toString());
  console.log(`  Found ${workspaceCategories.length} workspace categories`);
  workspaceCategories.forEach((cat: any) => {
    console.log(`  - ${cat.id}: ${cat.customName || cat.name}`);
  });
  console.log('✅ Test 4 passed\n');
} catch (error) {
  console.error('❌ Test 4 failed:', error, '\n');
}

// Test 5: Category state management
try {
  console.log('✓ Test 5: Testing category state management...');
  const testUserId = 'test-user-123';
  
  // Set multiple categories to build history
  await categoryService.setCurrentCategory(testUserId, 'automation');
  await categoryService.setCurrentCategory(testUserId, 'drafting');
  await categoryService.setCurrentCategory(testUserId, 'coding');
  
  const result = await categoryService.getCurrentCategory(testUserId);
  console.log(`  Current: ${result}`);
  if (result) {
    console.log('✅ Test 5 passed\n');
  } else {
    throw new Error('No current category set');
  }
} catch (error) {
  console.error('❌ Test 5 failed:', error, '\n');
}

console.log('🎉 All API route tests completed!');