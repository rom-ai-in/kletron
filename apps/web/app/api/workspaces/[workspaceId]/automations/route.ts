// apps/web/app/api/workspaces/[workspaceId]/automations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { workspaceCategoryService } from '@kletron/server/services/workspaceCategoryService';

/**
 * GET /api/workspaces/[workspaceId]/automations
 * Get all automations for a workspace
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const { workspaceId } = await params;
  const automations = workspaceCategoryService.getAutomations(workspaceId);

  return NextResponse.json(automations);
}

/**
 * POST /api/workspaces/[workspaceId]/automations
 * Add an automation to a workspace
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const { workspaceId } = await params;
  const body = await request.json();

  const { name, description, schedule, categoryId, config } = body;

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const automation = await workspaceCategoryService.addAutomation(
    workspaceId,
    name,
    description,
    schedule,
    categoryId,
    config,
  );

  return NextResponse.json(automation);
}
