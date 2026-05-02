import type { ChannelId } from "@kletron/shared/channelTypes";
import type { TelegramInlineKeyboard } from "./telegramChannelAdapter";
import { channelChatContextService } from "./channelChatContextService";
import { channelStoreService } from "./channelStoreService";
import { assertUserOwnsWorkspace } from "./channelResolverService";
import { parseSlashCommand } from "./channelSlashParse";
import { getWorkspaceById, listWorkspaces } from "./workspaceService";

export type ChannelCommandResult =
    | {
          handled: true;
          replyText: string;
          /** Telegram only */
          replyMarkup?: TelegramInlineKeyboard;
      }
    | { handled: false };

/**
 * Handle slash commands and pending workspace index picks. Returns handled=true if the agent must not run.
 */
export async function handleChannelUserCommand(params: {
    channel: ChannelId;
    text: string;
    externalChatKey: string;
    externalUserId: string;
}): Promise<ChannelCommandResult> {
    const { channel, externalChatKey, externalUserId } = params;
    const text = params.text.trim();

    const kletronUserId = await channelStoreService.findKletronUserIdForExternalUser(channel, externalUserId);
    if (!kletronUserId) {
        if (text.startsWith("/")) {
            return {
                handled: true,
                replyText:
                    "Your Telegram account is not linked to Kletron. Open the app → Configuration → Messenger channels, enter your Telegram user id, and link.",
            };
        }
        return { handled: false };
    }

    const ctx = await channelChatContextService.getByChatKey(channel, externalChatKey);

    // Pending numeric pick (1–9) after /switch list
    if (ctx?.pending?.kind === "awaiting_workspace_index" && /^\d+$/.test(text)) {
        const n = parseInt(text, 10);
        if (n >= 1 && n <= 50) {
            const workspaces = await listWorkspaces(kletronUserId);
            const picked = workspaces[n - 1];
            if (picked?._id) {
                await channelChatContextService.setActiveWorkspace(
                    channel,
                    externalChatKey,
                    externalUserId,
                    kletronUserId,
                    picked._id.toString()
                );
                return {
                    handled: true,
                    replyText: `Active workspace is now "${picked.name || picked._id}". Your next messages use this workspace's agent.`,
                };
            }
        }
        await channelChatContextService.setPending(channel, externalChatKey, externalUserId, kletronUserId, null);
        return { handled: true, replyText: "Invalid number. Send /switch to see the list again." };
    }

    if (!text.startsWith("/")) {
        return { handled: false };
    }

    const { cmd, rest } = parseSlashCommand(text);

    if (cmd === "help" || cmd === "start") {
        return {
            handled: true,
            replyText:
                "Commands:\n/switch — pick workspace (or use buttons)\n/workspaces — same\n/help — this message\n\nGroups: workspace is per chat. Link your account in the Kletron app first.",
        };
    }

    if (cmd === "workspaces" || cmd === "switch") {
        if (rest) {
            const target = rest.trim();
            const workspaces = await listWorkspaces(kletronUserId);
            const byId = workspaces.find((w) => w._id?.toString() === target);
            const byName = workspaces.filter(
                (w) => (w.name || "").toLowerCase() === target.toLowerCase()
            );
            let pick = byId;
            if (!pick && byName.length === 1) pick = byName[0];
            if (pick?._id) {
                const ok = await assertUserOwnsWorkspace(kletronUserId, pick._id.toString());
                if (ok) {
                    await channelChatContextService.setActiveWorkspace(
                        channel,
                        externalChatKey,
                        externalUserId,
                        kletronUserId,
                        pick._id.toString()
                    );
                    await channelChatContextService.setPending(channel, externalChatKey, externalUserId, kletronUserId, null);
                    return {
                        handled: true,
                        replyText: `Switched to "${pick.name || pick._id}".`,
                    };
                }
            }
            return {
                handled: true,
                replyText: "Workspace not found. Send /switch to see your workspaces.",
            };
        }

        const workspaces = await listWorkspaces(kletronUserId);
        if (!workspaces.length) {
            return { handled: true, replyText: "You have no workspaces yet. Create one in the Kletron app." };
        }

        const lines = workspaces.map((w, i) => `${i + 1}. ${w.name || w._id} (${w._id})`);
        await channelChatContextService.setPending(channel, externalChatKey, externalUserId, kletronUserId, {
            kind: "awaiting_workspace_index",
        });

        const keyboard: TelegramInlineKeyboard = {
            inline_keyboard: workspaces.slice(0, 8).map((w, i) => [
                {
                    text: `${i + 1}`,
                    callback_data: `w:${w._id!.toString()}`,
                },
            ]),
        };

        return {
            handled: true,
            replyText: `Your workspaces (reply with a number or tap a button):\n\n${lines.join("\n")}`,
            replyMarkup: keyboard,
        };
    }

    return { handled: false };
}

/**
 * Telegram callback_query data: `w:<24hex workspace ObjectId>`
 */
export async function handleTelegramWorkspaceCallback(params: {
    callbackData: string;
    externalChatKey: string;
    externalUserId: string;
}): Promise<{ ok: true; replyText: string } | { ok: false; replyText: string }> {
    const { callbackData, externalChatKey, externalUserId } = params;
    if (!callbackData.startsWith("w:")) {
        return { ok: false, replyText: "Unknown action." };
    }
    const wsId = callbackData.slice(2).trim();
    const channel: ChannelId = "telegram";
    const kletronUserId = await channelStoreService.findKletronUserIdForExternalUser(channel, externalUserId);
    if (!kletronUserId) {
        return { ok: false, replyText: "Not linked." };
    }
    const ok = await assertUserOwnsWorkspace(kletronUserId, wsId);
    if (!ok) {
        return { ok: false, replyText: "You cannot use that workspace." };
    }
    const ws = await getWorkspaceById(wsId, kletronUserId);
    await channelChatContextService.setActiveWorkspace(
        channel,
        externalChatKey,
        externalUserId,
        kletronUserId,
        wsId
    );
    await channelChatContextService.setPending(channel, externalChatKey, externalUserId, kletronUserId, null);
    return {
        ok: true,
        replyText: `Active workspace: ${ws?.name || wsId}`,
    };
}
