// apps/web/app/api/work-categories/current/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { categoryService } from '@kletron/server/services/categoryService';

/**
 * GET /api/work-categories/current - Get current category for user
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user || !(session.user as any).id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get current category for user
    const result = await categoryService.getCurrentCategory((session.user as any).id);
    
    if (!result) {
      return NextResponse.json({ 
        success: true, 
        data: null 
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    console.error('Error fetching current category:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
