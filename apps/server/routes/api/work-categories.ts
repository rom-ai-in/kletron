// apps/server/routes/api/work-categories.ts
import { Hono } from "hono";
import { categoryService } from "@kletron/server/services/categoryService";
import { workspaceService } from "@kletron/server/src/services/workspaceService";
import { resolveWorkspaceFromRequest, WorkspaceResolutionError } from "@kletron/server/src/services/workspaceService";

const app = new Hono();

// Get all available categories
app.get("/", async (c) => {
  try {
    const categories = await categoryService.getAllCategories();
    return c.json({ success: true, data: categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return c.json({ success: false, error: "Failed to fetch categories" }, 500);
  }
});

// Get workspace-specific categories
app.get("/workspace", async (c) => {
  try {
    const workspace = await resolveWorkspaceFromRequest(c.req, c.get("userId"));
    if (!workspace) {
      return c.json({ success: false, error: "No active workspace" }, 400);
    }
    
    const categories = await categoryService.getWorkspaceCategories(workspace.id);
    return c.json({ success: true, data: categories });
  } catch (error) {
    if (error instanceof WorkspaceResolutionError) {
      return c.json({ success: false, error: error.message }, 400);
    }
    console.error("Error fetching workspace categories:", error);
    return c.json({ success: false, error: "Failed to fetch workspace categories" }, 500);
  }
});

// Create/update workspace category
app.post("/workspace", async (c) => {
  try {
    const { categoryId, customName, customTools } = await c.req.json();
    
    if (!categoryId) {
      return c.json({ success: false, error: "categoryId is required" }, 400);
    }
    
    const workspace = await resolveWorkspaceFromRequest(c.req, c.get("userId"));
    if (!workspace) {
      return c.json({ success: false, error: "No active workspace" }, 400);
    }
    
    // Check if category exists
    const baseCategory = await categoryService.getCategoryById(categoryId);
    if (!baseCategory) {
      return c.json({ success: false, error: `Category ${categoryId} not found` }, 404);
    }
    
    // Create or update workspace category
    const result = await categoryService.createWorkspaceCategory(
      workspace.id,
      categoryId,
      { customName, customTools }
    );
    
    return c.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof WorkspaceResolutionError) {
      return c.json({ success: false, error: error.message }, 400);
    }
    console.error("Error creating workspace category:", error);
    return c.json({ success: false, error: "Failed to create workspace category" }, 500);
  }
});

// Update workspace category
app.put("/workspace/:categoryId", async (c) => {
  try {
    const categoryId = c.req.param("categoryId");
    const { customName, customTools } = await c.req.json();
    
    if (!customName && !customTools) {
      return c.json({ success: false, error: "At least one field (customName or customTools) is required" }, 400);
    }
    
    const workspace = await resolveWorkspaceFromRequest(c.req, c.get("userId"));
    if (!workspace) {
      return c.json({ success: false, error: "No active workspace" }, 400);
    }
    
    const result = await categoryService.updateWorkspaceCategory(
      workspace.id,
      categoryId,
      { customName, customTools }
    );
    
    if (!result) {
      return c.json({ success: false, error: "Category not found" }, 404);
    }
    
    return c.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof WorkspaceResolutionError) {
      return c.json({ success: false, error: error.message }, 400);
    }
    console.error("Error updating workspace category:", error);
    return c.json({ success: false, error: "Failed to update workspace category" }, 500);
  }
});

// Delete workspace category
app.delete("/workspace/:categoryId", async (c) => {
  try {
    const categoryId = c.req.param("categoryId");
    
    const workspace = await resolveWorkspaceFromRequest(c.req, c.get("userId"));
    if (!workspace) {
      return c.json({ success: false, error: "No active workspace" }, 400);
    }
    
    const success = await categoryService.deleteWorkspaceCategory(workspace.id, categoryId);
    
    if (!success) {
      return c.json({ success: false, error: "Category not found or already deleted" }, 404);
    }
    
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof WorkspaceResolutionError) {
      return c.json({ success: false, error: error.message }, 400);
    }
    console.error("Error deleting workspace category:", error);
    return c.json({ success: false, error: "Failed to delete workspace category" }, 500);
  }
});

// Get current category for user
app.get("/current", async (c) => {
  try {
    const userId = c.get("userId");
    const workspaceId = c.req.query("workspaceId");
    
    const category = await categoryService.getCurrentCategory(userId, workspaceId || undefined);
    
    if (!category) {
      return c.json({ success: true, data: null });
    }
    
    // Get full category details
    const fullCategory = await categoryService.getCategoryById(category);
    
    return c.json({ success: true, data: fullCategory });
  } catch (error) {
    console.error("Error fetching current category:", error);
    return c.json({ success: false, error: "Failed to fetch current category" }, 500);
  }
});

// Set current category for user
app.post("/current", async (c) => {
  try {
    const { categoryId } = await c.req.json();
    const userId = c.get("userId");
    const workspaceId = c.req.query("workspaceId");
    
    if (!categoryId) {
      return c.json({ success: false, error: "categoryId is required" }, 400);
    }
    
    // Verify category exists
    const category = await categoryService.getCategoryById(categoryId);
    if (!category) {
      return c.json({ success: false, error: `Category ${categoryId} not found` }, 404);
    }
    
    await categoryService.setCurrentCategory(userId, categoryId, workspaceId || undefined);
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error setting current category:", error);
    return c.json({ success: false, error: "Failed to set current category" }, 500);
  }
});

// Get category history
app.get("/history", async (c) => {
  try {
    const userId = c.get("userId");
    const workspaceId = c.req.query("workspaceId");
    
    const history = await categoryService.getCategoryHistory(userId, workspaceId || undefined);
    
    // Get full details for each category
    const categories = await Promise.all(
      history.map(async (id) => {
        const cat = await categoryService.getCategoryById(id);
        return cat || { id, name: "Unknown", description: "" };
      })
    );
    
    return c.json({ success: true, data: categories });
  } catch (error) {
    console.error("Error fetching category history:", error);
    return c.json({ success: false, error: "Failed to fetch category history" }, 500);
  }
});

// Get recommended categories for workspace
app.get("/workspace/recommendations", async (c) => {
  try {
    const workspace = await resolveWorkspaceFromRequest(c.req, c.get("userId"));
    if (!workspace) {
      return c.json({ success: false, error: "No active workspace" }, 400);
    }
    
    // Get file extensions from workspace
    const files = await workspaceService.listFiles(workspace.id, { limit: 100 });
    const extensions = files.map(f => f.name.split('.').pop()?.toLowerCase()).filter(Boolean) as string[];
    
    // Recommend categories based on file types
    const recommendations: any[] = [];
    
    if (extensions.some(ext => ["js", "ts", "jsx", "tsx", "py", "java", "cpp", "h", "go", "rs"].includes(ext))) {
      recommendations.push({ id: "coding", score: 0.9 });
    }
    
    if (extensions.some(ext => ["md", "txt", "docx", "pdf"].includes(ext))) {
      recommendations.push({ id: "drafting", score: 0.7 });
    }
    
    // Always include general
    recommendations.push({ id: "general", score: 0.5 });
    
    return c.json({ success: true, data: recommendations.sort((a, b) => b.score - a.score) });
  } catch (error) {
    if (error instanceof WorkspaceResolutionError) {
      return c.json({ success: false, error: error.message }, 400);
    }
    console.error("Error fetching recommendations:", error);
    return c.json({ success: false, error: "Failed to fetch recommendations" }, 500);
  }
});

export default app;