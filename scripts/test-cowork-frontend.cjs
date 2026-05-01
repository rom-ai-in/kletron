// Test script to verify CoWork implementation
const fs = require('fs');
const path = require('path');

console.log("🧪 Testing Kletron CoWork Implementation...\n");

// Check if required files exist - use current working directory
const baseDir = process.cwd();
const filesToCheck = [
  'apps/web/app/app/workbench/page.tsx',
  'apps/web/app/app/workbench/layout.tsx',
  'apps/web/components/CategorySelector.tsx',
  'apps/web/components/FileTree.tsx',
  'apps/web/hooks/useWorkCategories.ts',
  'apps/web/hooks/useCurrentCategory.ts',
  'apps/web/hooks/useLocalStorage.ts',
  'apps/web/app/api/work-categories/route.ts'
];

let allFilesExist = true;
filesToCheck.forEach(file => {
  const fullPath = path.join(baseDir, file);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

console.log("\n" + "=".repeat(60));

// Check if backend service exists
const backendServicePath = path.join(baseDir, 'packages/server/src/services/categoryService.ts');
if (fs.existsSync(backendServicePath)) {
  console.log("✅ Backend category service exists");
} else {
  console.log("❌ Backend category service missing");
  allFilesExist = false;
}

console.log("\n" + "=".repeat(60));

if (allFilesExist) {
  console.log("\n🎉 All CoWork components are in place!");
  console.log("\nTo test the frontend:");
  console.log("1. Run: npm run dev");
  console.log("2. Navigate to: http://localhost:3000/app/workbench");
  console.log("3. You should see the CoWork interface with category selector");
} else {
  console.log("\n❌ Some files are missing. Please check the implementation.");
}
