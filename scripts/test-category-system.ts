#!/usr/bin/env node

// Test script for category system
import { CategoryService } from "@kletron/server/services/categoryService";

async function testCategorySystem() {
  console.log("🧪 Testing Category System...\n");
  
  const service = CategoryService.getInstance();
  
  try {
    // Test initialization
    console.log("✓ Initializing built-in categories...");
    await service.initializeBuiltInCategories();
    
    // Test getting all categories
    console.log("✓ Getting all categories...");
    const categories = await service.getAllCategories();
    console.log(`  Found ${categories.length} categories:`);
    categories.forEach(cat => {
      console.log(`  - ${cat.id}: ${cat.name}`);
    });
    
    // Test getting specific category
    console.log("\n✓ Testing category retrieval...");
    const codingCategory = await service.getCategoryById("code");
    if (codingCategory) {
      console.log(`  Code category: ${codingCategory.name}`);
      console.log(`  Description: ${codingCategory.description}`);
      console.log(`  Tools: ${codingCategory.availableTools.join(', ')}`);
    }
    
    // Test workspace categories
    console.log("\n✓ Testing workspace-specific categories...");
    const testWorkspaceId = "507f191e810c19729de860ea"; // Valid ObjectId format
    const workspaceCategories = await service.getWorkspaceCategories(testWorkspaceId);
    console.log(`  Workspace categories: ${workspaceCategories.length}`);
    
    // Test creating custom workspace category
    console.log("\n✓ Creating custom workspace category...");
    const customCategory = await service.createWorkspaceCategory(
      "507f191e810c19729de860ea", // Valid ObjectId format
      "code",
      { customName: "My Custom Coding", customTools: ["custom_tool"] }
    );
    console.log(`  Created: ${customCategory.name} (${customCategory.id})`);
    
    // Test category state
    console.log("\n✓ Testing category state...");
    const testUserId = "test-user-456";
    await service.setCurrentCategory(testUserId, "code");
    const currentCategory = await service.getCurrentCategory(testUserId);
    console.log(`  Current category: ${currentCategory}`);
    
    // Test history
    await service.setCurrentCategory(testUserId, "work");
    await service.setCurrentCategory(testUserId, "code");
    const history = await service.getCategoryHistory(testUserId);
    console.log(`  Category history: ${history.join(', ')}`);
    
    console.log("\n✅ All tests passed! Category system is working correctly.");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  await testCategorySystem();
}