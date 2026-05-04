/**
 * Additional Kletron admin tools: channels, workspace context, categories,
 * instance LLM/embedding/tool-approval, vectors, user preferences.
 * See kletronAdminTools.ts for shared audit/identity patterns.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { ChannelId } from "@kletron/shared/channelTypes";
import {
    AzureOpenAIConfigSchema,
    ClaudeConfigSchema,
    GeminiConfigSchema,
    LMStudioConfigSchema,
    OllamaConfigSchema,
    OpenAIConfigSchema,
    VLLMConfigSchema,
    LLM_PROVIDERS,
    type LlmProviderType,
} from "@kletron/shared/schemas/llmConfig.schema";
import {
    AzureEmbeddingConfigSchema,
    GeminiEmbeddingConfigSchema,
    LMStudioEmbeddingConfigSchema,
    OllamaEmbeddingConfigSchema,
    OpenAIEmbeddingConfigSchema,
    VoyageEmbeddingConfigSchema,
    EMBEDDING_PROVIDERS,
    type EmbeddingProviderType,
} from "@kletron/shared/schemas/embeddingConfig.schema";

import { asJson, requireRunIdentity, withAudit } from "./kletronAdminHelpers";
import { getToolApprovalConfig, saveToolApprovalConfig, type SaveToolApprovalConfigInput } from "@kletron/server/config";
import {
    getWorkspaceContextConfig,
    saveWorkspaceContextConfig,
    type SaveWorkspaceContextConfigInput,
} from "@kletron/server/services/auditContextService";
import { channelAppSecretsService } from "@kletron/server/services/channelAppSecretsService";
import { channelStoreService } from "@kletron/server/services/channelStoreService";
import { isChannelSecretsEncryptionConfigured } from "@kletron/server/services/channelSecretsCrypto";
import { categoryService } from "@kletron/server/services/categoryService";
import {
    getEmbeddingConfigMaskedForDisplay,
    resetEmbeddingToEnvConfig,
    updateAzureEmbeddingConfig,
    updateDefaultEmbeddingProvider,
    updateGeminiEmbeddingConfig,
    updateLMStudioEmbeddingConfig,
    updateOllamaEmbeddingConfig,
    updateOpenAIEmbeddingConfig,
    updateVoyageEmbeddingConfig,
} from "@kletron/server/services/embeddingConfigService";
import {
    getLlmConfigMaskedForDisplay,
    resetToDefaultConfig,
    setProviderEnabled,
    updateAzureConfig,
    updateClaudeConfig,
    updateDefaultProvider,
    updateGeminiConfig,
    updateLMStudioConfig,
    updateOllamaConfig,
    updateOpenAIConfig,
    updateVLLMConfig,
} from "@kletron/server/services/llmConfigService";
import { assertKletronAgentInstanceConfigWritesAllowed } from "@kletron/server/services/kletronAgentInstanceConfigGate";
import { refreshIndexStatus, startIndexing } from "@kletron/server/services/indexerService";
import { getSchedulerStatus } from "@kletron/server/services/autoIndexScheduler";
import * as userPreferencesService from "@kletron/server/services/userPreferencesService";
import { getWorkspaceById } from "@kletron/server/services/workspaceService";
import { workspaceChannelSettingsService } from "@kletron/server/services/workspaceChannelSettingsService";

const channelIdSchema = z.enum(["telegram", "slack", "whatsapp"]);

function requireWorkspaceAccess(workspaceId: string, userId: string) {
    return getWorkspaceById(workspaceId, userId);
}

// ─── Channels ───────────────────────────────────────────────────────────────

export const kletronGetWorkspaceChannelSettings = tool(
    async (input: { channel: ChannelId }) => {
        return await withAudit("kletron_get_workspace_channel_settings", input, async () => {
            const id = requireRunIdentity();
            const ws = await requireWorkspaceAccess(id.workspaceId, id.userId);
            if (!ws) throw new Error("Workspace not found or access denied.");
            const doc = await workspaceChannelSettingsService.get(id.workspaceId, input.channel);
            return asJson({
                workspaceId: id.workspaceId,
                channel: input.channel,
                enabled: doc?.enabled ?? true,
                defaultGraphId: doc?.defaultGraphId ?? "",
            });
        });
    },
    {
        name: "kletron_get_workspace_channel_settings",
        description:
            "Read messenger channel settings for the current workspace (enabled flag, default agent graph id). Channels: telegram, slack, whatsapp.",
        schema: z.object({ channel: channelIdSchema }),
    }
);

export const kletronUpdateWorkspaceChannelSettings = tool(
    async (input: { channel: ChannelId; enabled?: boolean; defaultGraphId?: string }) => {
        return await withAudit("kletron_update_workspace_channel_settings", input, async () => {
            const id = requireRunIdentity();
            const ws = await requireWorkspaceAccess(id.workspaceId, id.userId);
            if (!ws) throw new Error("Workspace not found or access denied.");
            await workspaceChannelSettingsService.upsert(id.workspaceId, input.channel, {
                ...(typeof input.enabled === "boolean" ? { enabled: input.enabled } : {}),
                ...(typeof input.defaultGraphId === "string" ? { defaultGraphId: input.defaultGraphId } : {}),
                updatedByUserId: id.userId,
            });
            return asJson({ ok: true });
        });
    },
    {
        name: "kletron_update_workspace_channel_settings",
        description:
            "Update per-workspace messenger defaults: enable/disable channel and default agent graph id for telegram/slack/whatsapp.",
        schema: z.object({
            channel: channelIdSchema,
            enabled: z.boolean().optional(),
            defaultGraphId: z.string().optional(),
        }),
    }
);

export const kletronGetAppMessengerStatus = tool(
    async () => {
        return await withAudit("kletron_get_app_messenger_status", {}, async () => {
            requireRunIdentity();
            const doc = await channelAppSecretsService.getDoc();
            const masked = channelAppSecretsService.getMaskedStatus(doc);
            return asJson({
                encryptionConfigured: isChannelSecretsEncryptionConfigured(),
                telegram: masked,
            });
        });
    },
    {
        name: "kletron_get_app_messenger_status",
        description:
            "Instance-wide: whether channel secrets encryption is configured and masked status of the global Telegram bot token / webhook secret (app credentials). Does not return raw secrets.",
        schema: z.object({}),
    }
);

export const kletronSetAppTelegramCredentials = tool(
    async (input: {
        confirm: true;
        botToken?: string;
        webhookSecret?: string;
        clearWebhookSecret?: boolean;
    }) => {
        return await withAudit("kletron_set_app_telegram_credentials", input, async () => {
            requireRunIdentity();
            assertKletronAgentInstanceConfigWritesAllowed("app Telegram credentials");
            await channelAppSecretsService.setTelegramSecrets({
                botToken: input.botToken,
                webhookSecret: input.webhookSecret,
                clearWebhookSecret: input.clearWebhookSecret === true,
            });
            return asJson({ ok: true });
        });
    },
    {
        name: "kletron_set_app_telegram_credentials",
        description:
            "INSTANCE-WIDE: set or update the global Telegram bot token and optional webhook secret (same as Channels UI app credentials). Requires confirm: true and KLETRON_AGENT_ALLOW_INSTANCE_CONFIG=1. Requires KLETRON_CHANNEL_SECRETS_KEY for storage.",
        schema: z.object({
            confirm: z.literal(true),
            botToken: z.string().optional(),
            webhookSecret: z.string().optional(),
            clearWebhookSecret: z.boolean().optional(),
        }),
    }
);

export const kletronLinkMessengerUser = tool(
    async (input: { channel: ChannelId; externalUserId: string }) => {
        return await withAudit("kletron_link_messenger_user", input, async () => {
            const id = requireRunIdentity();
            const ws = await requireWorkspaceAccess(id.workspaceId, id.userId);
            if (!ws) throw new Error("Workspace not found or access denied.");
            await channelStoreService.linkUser({
                workspaceId: id.workspaceId,
                channel: input.channel,
                externalUserId: input.externalUserId.trim(),
                kletronUserId: id.userId,
            });
            return asJson({ ok: true, message: "Linked your messenger id to this workspace for routing/audit." });
        });
    },
    {
        name: "kletron_link_messenger_user",
        description:
            "Link the current Kletron user to a messenger user id (Telegram/Slack/WhatsApp) for this workspace so inbound messages can be attributed. Does not set tokens; use workspace channel settings + app credentials for that.",
        schema: z.object({
            channel: channelIdSchema,
            externalUserId: z.string().min(1),
        }),
    }
);

// ─── Workspace context (audit context) ─────────────────────────────────────

export const kletronGetWorkspaceContextConfig = tool(
    async () => {
        return await withAudit("kletron_get_workspace_context_config", {}, async () => {
            const id = requireRunIdentity();
            const ws = await requireWorkspaceAccess(id.workspaceId, id.userId);
            if (!ws) throw new Error("Workspace not found or access denied.");
            const cfg = await getWorkspaceContextConfig(id.workspaceId);
            if (!cfg) throw new Error("No context config.");
            return asJson(cfg);
        });
    },
    {
        name: "kletron_get_workspace_context_config",
        description:
            "Read workspace Context configuration (audit/injection settings under /app/config/context).",
        schema: z.object({}),
    }
);

export const kletronUpdateWorkspaceContextConfig = tool(
    async (input: SaveWorkspaceContextConfigInput) => {
        return await withAudit("kletron_update_workspace_context_config", input, async () => {
            const id = requireRunIdentity();
            const ws = await requireWorkspaceAccess(id.workspaceId, id.userId);
            if (!ws) throw new Error("Workspace not found or access denied.");
            const saved = await saveWorkspaceContextConfig(id.workspaceId, input);
            return asJson(saved);
        });
    },
    {
        name: "kletron_update_workspace_context_config",
        description: "Update workspace Context configuration (enabled, audit context, injection). Same fields as PUT /api/context-config.",
        schema: z.object({
            enabled: z.boolean().optional(),
            context: z.any().nullable().optional(),
            injection: z.any().optional(),
        }),
    }
);

// ─── Work categories ──────────────────────────────────────────────────────────

export const kletronListWorkspaceCategories = tool(
    async () => {
        return await withAudit("kletron_list_workspace_categories", {}, async () => {
            const id = requireRunIdentity();
            const ws = await requireWorkspaceAccess(id.workspaceId, id.userId);
            if (!ws) throw new Error("Workspace not found or access denied.");
            const list = await categoryService.getWorkspaceCategories(id.workspaceId);
            return asJson(list);
        });
    },
    {
        name: "kletron_list_workspace_categories",
        description: "List work categories configured for the current workspace.",
        schema: z.object({}),
    }
);

export const kletronCreateWorkspaceCategory = tool(
    async (input: { baseCategoryId: string; customName?: string; customTools?: string[] }) => {
        return await withAudit("kletron_create_workspace_category", input, async () => {
            const id = requireRunIdentity();
            const ws = await requireWorkspaceAccess(id.workspaceId, id.userId);
            if (!ws) throw new Error("Workspace not found or access denied.");
            const created = await categoryService.createWorkspaceCategory(id.workspaceId, input.baseCategoryId, {
                customName: input.customName,
                customTools: input.customTools,
            });
            return asJson(created);
        });
    },
    {
        name: "kletron_create_workspace_category",
        description:
            "Create a workspace-specific overlay from a base category id (e.g. code, work). Optional custom name and tool list.",
        schema: z.object({
            baseCategoryId: z.string().min(1),
            customName: z.string().optional(),
            customTools: z.array(z.string()).optional(),
        }),
    }
);

export const kletronUpdateWorkspaceCategory = tool(
    async (input: { categoryId: string; customName?: string; customTools?: string[] }) => {
        return await withAudit("kletron_update_workspace_category", input, async () => {
            const id = requireRunIdentity();
            const ws = await requireWorkspaceAccess(id.workspaceId, id.userId);
            if (!ws) throw new Error("Workspace not found or access denied.");
            const updated = await categoryService.updateWorkspaceCategory(id.workspaceId, input.categoryId, {
                customName: input.customName,
                customTools: input.customTools,
            });
            return asJson(updated);
        });
    },
    {
        name: "kletron_update_workspace_category",
        description: "Update custom name/tools for a workspace category overlay.",
        schema: z.object({
            categoryId: z.string().min(1),
            customName: z.string().optional(),
            customTools: z.array(z.string()).optional(),
        }),
    }
);

export const kletronDeleteWorkspaceCategory = tool(
    async (input: { categoryId: string; confirm: true }) => {
        return await withAudit("kletron_delete_workspace_category", input, async () => {
            const id = requireRunIdentity();
            const ws = await requireWorkspaceAccess(id.workspaceId, id.userId);
            if (!ws) throw new Error("Workspace not found or access denied.");
            const ok = await categoryService.deleteWorkspaceCategory(id.workspaceId, input.categoryId);
            return asJson({ ok });
        });
    },
    {
        name: "kletron_delete_workspace_category",
        description: "Remove a workspace category overlay. Requires confirm: true.",
        schema: z.object({
            categoryId: z.string().min(1),
            confirm: z.literal(true),
        }),
    }
);

// ─── Instance LLM / embedding / tool approval ────────────────────────────────

const llmOpSchema = z.enum([
    "set_default_provider",
    "reset_all",
    "set_provider_enabled",
    "update_azure",
    "update_openai",
    "update_claude",
    "update_gemini",
    "update_lmstudio",
    "update_ollama",
    "update_vllm",
]);

export const kletronGetLlmConfig = tool(
    async () => {
        return await withAudit("kletron_get_llm_config", {}, async () => {
            requireRunIdentity();
            const masked = await getLlmConfigMaskedForDisplay();
            return asJson(masked);
        });
    },
    {
        name: "kletron_get_llm_config",
        description:
            "INSTANCE: read LLM configuration with API keys masked (same as /api/llm-config GET).",
        schema: z.object({}),
    }
);

export const kletronConfigureLlm = tool(
    async (input: {
        confirm: true;
        operation: z.infer<typeof llmOpSchema>;
        defaultProvider?: string;
        provider?: string;
        enabled?: boolean;
        config?: Record<string, unknown>;
    }) => {
        return await withAudit("kletron_configure_llm", input, async () => {
            requireRunIdentity();
            assertKletronAgentInstanceConfigWritesAllowed("LLM configuration");
            const op = input.operation;
            if (op === "set_default_provider") {
                const p = input.defaultProvider?.trim();
                if (!p || !LLM_PROVIDERS.includes(p as LlmProviderType)) {
                    throw new Error(`defaultProvider must be one of: ${LLM_PROVIDERS.join(", ")}`);
                }
                const cfg = await updateDefaultProvider(p as LlmProviderType);
                return asJson(cfg);
            }
            if (op === "reset_all") {
                const cfg = await resetToDefaultConfig();
                return asJson(cfg);
            }
            if (op === "set_provider_enabled") {
                const p = input.provider?.trim();
                if (!p || !LLM_PROVIDERS.includes(p as LlmProviderType)) {
                    throw new Error(`provider must be one of: ${LLM_PROVIDERS.join(", ")}`);
                }
                if (typeof input.enabled !== "boolean") throw new Error("enabled boolean required");
                const cfg = await setProviderEnabled(p as LlmProviderType, input.enabled);
                return asJson(cfg);
            }
            const raw = input.config ?? {};
            switch (op) {
                case "update_azure":
                    return asJson(await updateAzureConfig(AzureOpenAIConfigSchema.parse(raw)));
                case "update_openai":
                    return asJson(await updateOpenAIConfig(OpenAIConfigSchema.parse(raw)));
                case "update_claude":
                    return asJson(await updateClaudeConfig(ClaudeConfigSchema.parse(raw)));
                case "update_gemini":
                    return asJson(await updateGeminiConfig(GeminiConfigSchema.parse(raw)));
                case "update_lmstudio":
                    return asJson(await updateLMStudioConfig(LMStudioConfigSchema.parse(raw)));
                case "update_ollama":
                    return asJson(await updateOllamaConfig(OllamaConfigSchema.parse(raw)));
                case "update_vllm":
                    return asJson(await updateVLLMConfig(VLLMConfigSchema.parse(raw)));
                default:
                    throw new Error("Unsupported operation");
            }
        });
    },
    {
        name: "kletron_configure_llm",
        description:
            "INSTANCE-WIDE LLM changes. Requires confirm: true and KLETRON_AGENT_ALLOW_INSTANCE_CONFIG=1. Operations: set_default_provider (defaultProvider), reset_all, set_provider_enabled (provider+enabled), or update_* with config object matching provider schema (API keys, endpoints).",
        schema: z.object({
            confirm: z.literal(true),
            operation: llmOpSchema,
            defaultProvider: z.string().optional(),
            provider: z.string().optional(),
            enabled: z.boolean().optional(),
            config: z.record(z.unknown()).optional(),
        }),
    }
);

const embOpSchema = z.enum([
    "set_default_provider",
    "reset_to_env",
    "update_azure",
    "update_openai",
    "update_voyage",
    "update_gemini",
    "update_lmstudio",
    "update_ollama",
]);

export const kletronGetEmbeddingConfig = tool(
    async () => {
        return await withAudit("kletron_get_embedding_config", {}, async () => {
            requireRunIdentity();
            return asJson(await getEmbeddingConfigMaskedForDisplay());
        });
    },
    {
        name: "kletron_get_embedding_config",
        description: "INSTANCE: read embedding configuration with API keys masked.",
        schema: z.object({}),
    }
);

export const kletronConfigureEmbedding = tool(
    async (input: {
        confirm: true;
        operation: z.infer<typeof embOpSchema>;
        defaultProvider?: string;
        config?: Record<string, unknown>;
    }) => {
        return await withAudit("kletron_configure_embedding", input, async () => {
            requireRunIdentity();
            assertKletronAgentInstanceConfigWritesAllowed("embedding configuration");
            const op = input.operation;
            if (op === "set_default_provider") {
                const p = input.defaultProvider?.trim();
                if (!p || !EMBEDDING_PROVIDERS.includes(p as EmbeddingProviderType)) {
                    throw new Error(`defaultProvider must be one of: ${EMBEDDING_PROVIDERS.join(", ")}`);
                }
                return asJson(await updateDefaultEmbeddingProvider(p as EmbeddingProviderType));
            }
            if (op === "reset_to_env") {
                return asJson(await resetEmbeddingToEnvConfig());
            }
            const raw = input.config ?? {};
            switch (op) {
                case "update_azure":
                    return asJson(await updateAzureEmbeddingConfig(AzureEmbeddingConfigSchema.parse(raw)));
                case "update_openai":
                    return asJson(await updateOpenAIEmbeddingConfig(OpenAIEmbeddingConfigSchema.parse(raw)));
                case "update_voyage":
                    return asJson(await updateVoyageEmbeddingConfig(VoyageEmbeddingConfigSchema.parse(raw)));
                case "update_gemini":
                    return asJson(await updateGeminiEmbeddingConfig(GeminiEmbeddingConfigSchema.parse(raw)));
                case "update_lmstudio":
                    return asJson(await updateLMStudioEmbeddingConfig(LMStudioEmbeddingConfigSchema.parse(raw)));
                case "update_ollama":
                    return asJson(await updateOllamaEmbeddingConfig(OllamaEmbeddingConfigSchema.parse(raw)));
                default:
                    throw new Error("Unsupported operation");
            }
        });
    },
    {
        name: "kletron_configure_embedding",
        description:
            "INSTANCE-WIDE embedding config. Requires confirm: true and KLETRON_AGENT_ALLOW_INSTANCE_CONFIG=1. Operations: set_default_provider, reset_to_env, or update_* with provider config object.",
        schema: z.object({
            confirm: z.literal(true),
            operation: embOpSchema,
            defaultProvider: z.string().optional(),
            config: z.record(z.unknown()).optional(),
        }),
    }
);

export const kletronGetToolApprovalConfig = tool(
    async () => {
        return await withAudit("kletron_get_tool_approval_config", {}, async () => {
            requireRunIdentity();
            return asJson(getToolApprovalConfig());
        });
    },
    {
        name: "kletron_get_tool_approval_config",
        description: "INSTANCE: read tool approval policy (auto-approve rules, per-tool overrides, default thread mode).",
        schema: z.object({}),
    }
);

export const kletronUpdateToolApprovalConfig = tool(
    async (input: SaveToolApprovalConfigInput & { confirm: true }) => {
        return await withAudit("kletron_update_tool_approval_config", input, async () => {
            requireRunIdentity();
            assertKletronAgentInstanceConfigWritesAllowed("tool approval policy");
            const { confirm: _c, ...rest } = input;
            const updated = await saveToolApprovalConfig(rest);
            return asJson(updated);
        });
    },
    {
        name: "kletron_update_tool_approval_config",
        description:
            "INSTANCE-WIDE: merge updates into tool approval config (same shape as PUT /api/config/tool-approval). Requires confirm: true and KLETRON_AGENT_ALLOW_INSTANCE_CONFIG=1.",
        schema: z.object({
            confirm: z.literal(true),
            autoApproveReadonlySources: z.array(z.string()).optional(),
            neverAutoApproveTools: z.array(z.string()).optional(),
            autoApproveSafeBash: z.boolean().optional(),
            toolOverrides: z.record(z.string(), z.enum(["always_approve", "always_require", "default"])).optional(),
            replaceToolOverrides: z.boolean().optional(),
            defaultThreadApprovalMode: z.enum(["inherit", "confirm_everything", "full_auto_thread"]).optional(),
        }),
    }
);

// ─── Vectors + user preferences ─────────────────────────────────────────────

export const kletronGetVectorIndexStatus = tool(
    async () => {
        return await withAudit("kletron_get_vector_index_status", {}, async () => {
            const id = requireRunIdentity();
            const ws = await requireWorkspaceAccess(id.workspaceId, id.userId);
            if (!ws || !ws.rootPath) throw new Error("Workspace not found or missing root path.");
            const workspaceId = id.workspaceId;
            const indexStatus = await refreshIndexStatus(workspaceId, ws.rootPath);
            const scheduler = getSchedulerStatus(workspaceId);
            const MAX_ERRORS = 50;
            const cappedErrors = indexStatus.errors.slice(-MAX_ERRORS);
            return asJson({
                ...indexStatus,
                errors: cappedErrors,
                autoIndexEnabled: !process.env.DISABLE_AUTO_INDEX,
                lastAutoIndex: scheduler.lastRun?.toISOString() ?? null,
                nextAutoIndex: scheduler.lastRun
                    ? new Date(scheduler.lastRun.getTime() + scheduler.intervalMs).toISOString()
                    : null,
                schedulerStatus: scheduler.isRunning ? "running" : scheduler.pendingRun ? "pending" : "idle",
                schedulerInterval: scheduler.intervalMs,
            });
        });
    },
    {
        name: "kletron_get_vector_index_status",
        description: "Workspace vector index status (chunk counts, scheduler). Same idea as GET /api/vectors.",
        schema: z.object({}),
    }
);

export const kletronRequestVectorReindex = tool(
    async (input: { confirm: true }) => {
        return await withAudit("kletron_request_vector_reindex", input, async () => {
            const id = requireRunIdentity();
            const ws = await requireWorkspaceAccess(id.workspaceId, id.userId);
            if (!ws || !ws.rootPath) throw new Error("Workspace not found or missing root path.");
            void startIndexing(id.workspaceId, ws.rootPath, true);
            return asJson({ ok: true, message: "Reindex started in background." });
        });
    },
    {
        name: "kletron_request_vector_reindex",
        description: "Start a full vector reindex for the current workspace (background). Requires confirm: true.",
        schema: z.object({ confirm: z.literal(true) }),
    }
);

export const kletronGetUserPreferences = tool(
    async () => {
        return await withAudit("kletron_get_user_preferences", {}, async () => {
            const id = requireRunIdentity();
            const prefs = await userPreferencesService.getPreferences(id.userId);
            return asJson(
                prefs ?? {
                    userId: id.userId,
                    selectedLlmProvider: null,
                    selectedGraphId: null,
                    updatedAt: null,
                }
            );
        });
    },
    {
        name: "kletron_get_user_preferences",
        description: "Read current user's UI preferences (selected LLM provider, graph id).",
        schema: z.object({}),
    }
);

export const kletronUpdateUserPreferences = tool(
    async (input: { selectedLlmProvider?: string | null; selectedGraphId?: string | null }) => {
        return await withAudit("kletron_update_user_preferences", input, async () => {
            const id = requireRunIdentity();
            if (input.selectedLlmProvider === undefined && input.selectedGraphId === undefined) {
                throw new Error("Provide at least one of selectedLlmProvider, selectedGraphId");
            }
            const prefs = await userPreferencesService.updatePreferences(id.userId, {
                selectedLlmProvider: input.selectedLlmProvider,
                selectedGraphId: input.selectedGraphId,
            });
            return asJson(prefs);
        });
    },
    {
        name: "kletron_update_user_preferences",
        description: "Update current user's preferences (partial).",
        schema: z.object({
            selectedLlmProvider: z.string().nullable().optional(),
            selectedGraphId: z.string().nullable().optional(),
        }),
    }
);

export const kletronExtendedAdminTools = [
    kletronGetWorkspaceChannelSettings,
    kletronUpdateWorkspaceChannelSettings,
    kletronGetAppMessengerStatus,
    kletronSetAppTelegramCredentials,
    kletronLinkMessengerUser,
    kletronGetWorkspaceContextConfig,
    kletronUpdateWorkspaceContextConfig,
    kletronListWorkspaceCategories,
    kletronCreateWorkspaceCategory,
    kletronUpdateWorkspaceCategory,
    kletronDeleteWorkspaceCategory,
    kletronGetLlmConfig,
    kletronConfigureLlm,
    kletronGetEmbeddingConfig,
    kletronConfigureEmbedding,
    kletronGetToolApprovalConfig,
    kletronUpdateToolApprovalConfig,
    kletronGetVectorIndexStatus,
    kletronRequestVectorReindex,
    kletronGetUserPreferences,
    kletronUpdateUserPreferences,
];
