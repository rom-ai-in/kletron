import { getDb } from "@kletron/server/lib/db";
import {
  formatAuditContextPrompt,
  normalizeAuditContext,
  type AuditContext,
} from "@kletron/shared/documentContext";
import {
  DEFAULT_WORKSPACE_CONTEXT_INJECTION,
  normalizeWorkspaceContextInjection,
  type WorkspaceContextInjectionSettings,
} from "@kletron/shared/workspaceContextInjection";

const COLLECTION = "audit_context_config";

export type AuditContextConfig = {
  enabled: boolean;
  context: AuditContext | null;
  updatedAt?: Date;
};

export type WorkspaceContextConfig = AuditContextConfig & {
  injection: WorkspaceContextInjectionSettings;
};

export async function getAuditContextConfig(workspaceId?: string | null): Promise<AuditContextConfig | null> {
  const full = await getWorkspaceContextConfig(workspaceId);
  if (!full) return null;
  return {
    enabled: full.enabled,
    context: full.context,
    updatedAt: full.updatedAt,
  };
}

export async function getWorkspaceContextConfig(workspaceId?: string | null): Promise<WorkspaceContextConfig | null> {
  if (!workspaceId) return null;
  const db = await getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId }, { projection: { _id: 0 } });
  if (!doc) {
    return {
      enabled: true,
      context: null,
      injection: { ...DEFAULT_WORKSPACE_CONTEXT_INJECTION },
    };
  }
  return {
    enabled: Boolean((doc as any).enabled),
    context: normalizeAuditContext((doc as any).context) ?? null,
    updatedAt: (doc as any).updatedAt,
    injection: normalizeWorkspaceContextInjection((doc as any).injection),
  };
}

export async function buildAuditContextPrompt(workspaceId?: string | null): Promise<string | null> {
  const config = await getAuditContextConfig(workspaceId);
  if (!config || !config.enabled || !config.context) return null;
  return formatAuditContextPrompt(config.context);
}

export type SaveWorkspaceContextConfigInput = {
  enabled?: boolean;
  context?: AuditContext | null;
  injection?: Partial<WorkspaceContextInjectionSettings>;
};

/**
 * Upsert workspace audit/context document (same behavior as PUT /api/context-config).
 */
export async function saveWorkspaceContextConfig(
  workspaceId: string,
  body: SaveWorkspaceContextConfigInput
): Promise<WorkspaceContextConfig & { updatedAt: Date }> {
  const enabled = typeof body.enabled === "boolean" ? body.enabled : true;
  const normalized = normalizeAuditContext(body.context) ?? null;
  const injection = normalizeWorkspaceContextInjection(body.injection);
  const now = new Date();
  const db = await getDb();
  const col = db.collection(COLLECTION);
  await col.updateOne(
    { workspaceId },
    {
      $set: {
        workspaceId,
        enabled,
        context: normalized,
        injection,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    } as any,
    { upsert: true }
  );
  return {
    enabled,
    context: normalized,
    injection,
    updatedAt: now,
  };
}
