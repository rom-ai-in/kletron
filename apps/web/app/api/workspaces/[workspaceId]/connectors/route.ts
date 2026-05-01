// apps/web/app/api/workspaces/[workspaceId]/connectors/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { workspaceCategoryService } from '@kletron/server/services/workspaceCategoryService';

/**
 * GET /api/workspaces/[workspaceId]/connectors
 * Get all connectors for a workspace
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const { workspaceId } = await params;
  const connectors = workspaceCategoryService.getConnectors(workspaceId);

  return NextResponse.json(connectors);
}

/**
 * POST /api/workspaces/[workspaceId]/connectors
 * Add a connector to a workspace
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const { workspaceId } = await params;
  const body = await request.json();

  const { connectorId, connected, category, config } = body;

  if (!connectorId) {
    return NextResponse.json({ error: 'connectorId is required' }, { status: 400 });
  }

  const connector = await workspaceCategoryService.addConnector(
    workspaceId,
    connectorId,
    connected ?? false,
    category,
    config,
  );

  return NextResponse.json(connector);
}
