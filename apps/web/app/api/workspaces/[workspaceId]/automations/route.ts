// apps/web/app/api/workspaces/[workspaceId]/automations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAppRouteAuth } from '@kletron/server/lib/auth/apiAuth';
import { workspaceCategoryService } from '@kletron/server/services/workspaceCategoryService';
import { getWorkspaceById, getWorkspaceByIdUnsafe } from '@kletron/server/services/workspaceService';

async function assertWorkspaceAccess(workspaceId: string, auth: { userId: string; authType: string }) {
  if (auth.authType === 'internal') {
    return getWorkspaceByIdUnsafe(workspaceId);
  }
  return getWorkspaceById(workspaceId, auth.userId);
}

/**
 * GET /api/workspaces/[workspaceId]/automations
 * Get all automations for a workspace
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const auth = await requireAppRouteAuth(_request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { workspaceId } = await params;
  const workspace = await assertWorkspaceAccess(workspaceId, auth);
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }
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
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { workspaceId } = await params;
  const workspace = await assertWorkspaceAccess(workspaceId, auth);
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }
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
