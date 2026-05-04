// apps/web/app/api/work-categories/workspace/route.ts
import { NextResponse } from 'next/server';
import { categoryService } from '@kletron/server/services/categoryService';
import { requireAppRouteAuth } from '@kletron/server/lib/auth/apiAuth';

/**
 * GET /api/work-categories/workspace - Get workspace-specific categories
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get workspace ID from query params
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    // Get workspace-specific categories
    const categories = await categoryService.getWorkspaceCategories(workspaceId);
    
    return NextResponse.json({ 
      success: true, 
      data: categories 
    });
  } catch (error) {
    console.error('Error fetching workspace categories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/work-categories/workspace - Create custom workspace category
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { workspaceId, baseCategoryId, config } = await request.json();
    
    if (!workspaceId || !baseCategoryId) {
      return NextResponse.json(
        { error: 'Workspace ID and base category ID are required' },
        { status: 400 }
      );
    }

    // Create custom workspace category
    const result = await categoryService.createWorkspaceCategory(
      workspaceId,
      baseCategoryId,
      config
    );
    
    return NextResponse.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    console.error('Error creating workspace category:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
