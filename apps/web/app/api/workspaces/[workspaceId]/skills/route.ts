// apps/web/app/api/workspaces/[workspaceId]/skills/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { workspaceCategoryService } from '@kletron/server/services/workspaceCategoryService';

/**
 * GET /api/workspaces/[workspaceId]/skills
 * Get all skills for a workspace
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const { workspaceId } = await params;
  const skills = workspaceCategoryService.getSkills(workspaceId);

  return NextResponse.json(skills);
}

/**
 * POST /api/workspaces/[workspaceId]/skills
 * Add a skill to a workspace
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const { workspaceId } = await params;
  const body = await request.json();

  const { skillId, enabled, category, config } = body;

  if (!skillId) {
    return NextResponse.json({ error: 'skillId is required' }, { status: 400 });
  }

  const skill = await workspaceCategoryService.addSkill(
    workspaceId,
    skillId,
    enabled ?? true,
    category,
    config,
  );

  return NextResponse.json(skill);
}
