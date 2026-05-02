// apps/server/middleware/categoryMiddleware.ts
import { MiddlewareHandler } from "hono";
import { categoryService } from "@kletron/server/services/categoryService";
import type { WorkCategoryConfig } from "@kletron/shared/categoryTypes";

export const withCategoryContext: MiddlewareHandler = async (c, next) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      await next();
      return;
    }
    
    // Try to get workspace from request
    let workspaceId: string | undefined;
    if (c.req.query("workspaceId")) {
      workspaceId = c.req.query("workspaceId");
    } else if (c.req.header("X-Workspace-Id")) {
      workspaceId = c.req.header("X-Workspace-Id");
    }
    
    // Get current category
    const currentCategoryId = await categoryService.getCurrentCategory(userId, workspaceId);
    
    if (currentCategoryId) {
      // Get full category details
      const category = await categoryService.getCategoryById(currentCategoryId);
      if (category) {
        c.set("currentCategory", category);
      }
    }
    
    await next();
  } catch (error) {
    console.error("Error in category middleware:", error);
    await next();
  }
};

// Helper to get current category from context
export async function getCurrentCategory(c: any): Promise<WorkCategoryConfig | null> {
  return c.get("currentCategory") || null;
}
