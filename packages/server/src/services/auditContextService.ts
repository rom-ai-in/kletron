import { getDb } from "@numezis/server/lib/db";
import {
  formatAuditContextPrompt,
  normalizeAuditContext,
  type AuditContext,
} from "@numezis/shared/documentContext";

const COLLECTION = "audit_context_config";

type AuditContextConfig = {
  enabled: boolean;
  context: AuditContext | null;
  updatedAt?: Date;
};

export async function getAuditContextConfig(workspaceId?: string | null): Promise<AuditContextConfig | null> {
  if (!workspaceId) return null;
  const db = await getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId }, { projection: { _id: 0 } });
  if (!doc) {
    return { enabled: true, context: null };
  }
  return {
    enabled: Boolean((doc as any).enabled),
    context: normalizeAuditContext((doc as any).context) ?? null,
    updatedAt: (doc as any).updatedAt,
  };
}

export async function buildAuditContextPrompt(workspaceId?: string | null): Promise<string | null> {
  const config = await getAuditContextConfig(workspaceId);
  if (!config || !config.enabled || !config.context) return null;
  return formatAuditContextPrompt(config.context);
}
