// apps/server/routes/api/test-category.ts
import { Hono } from "hono";
import { categoryService } from "@kletron/server/services/categoryService";
import { CategoryWorkflowRunner } from "@kletron/agent-core/categoryWorkflowRunner";

const app = new Hono();

// Test endpoint to verify category system works
app.get("/test", async (c) => {
  try {
    // Initialize categories if needed
    await categoryService.initializeBuiltInCategories();
    
    // Get all categories
    const categories = await categoryService.getAllCategories();
    
    return c.json({
      success: true,
      message: "Category system is working",
      categories,
      count: categories.length
    });
  } catch (error) {
    console.error("Error in test endpoint:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Test category detection
app.post("/test/detect", async (c) => {
  try {
    const { message } = await c.req.json();
    
    if (!message) {
      return c.json({ success: false, error: "message is required" }, 400);
    }
    
    // Initialize categories
    await categoryService.initializeBuiltInCategories();
    const allCategories = await categoryService.getAllCategories();
    
    // Detect category
    const runner = CategoryWorkflowRunner.getInstance();
    const detectedCategory = await runner.determineCategory(message, allCategories);
    
    return c.json({
      success: true,
      message: "Category detection successful",
      inputMessage: message,
      detectedCategory
    });
  } catch (error) {
    console.error("Error in category detection:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

export default app;