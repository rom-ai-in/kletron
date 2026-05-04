/**
 * Multi-channel agent gateway — normalized inbound events and routing.
 * Adapters (Telegram, Slack, …) map platform payloads to these types.
 */

import type { ThreadApprovalMode } from "./threadApprovalTypes";

export const CHANNEL_IDS = ["telegram", "slack", "whatsapp"] as const;

export type ChannelId = (typeof CHANNEL_IDS)[number];

export type NormalizedInboundEvent = {
    channel: ChannelId;
    /** Stable opaque key for DM vs group/thread (adapter-defined, must be stable per conversation). */
    externalChatKey: string;
    externalUserId: string;
    text: string;
    /** Platform message id for idempotency (dedup webhook retries). */
    inboundMessageId: string;
    replyToMessageId?: string;
    attachments?: Array<{ kind: "image" | "file" | "other"; url?: string; name?: string }>;
    /** Small opaque blob for logs (no secrets). */
    rawRef?: string;
};

export type ChannelRoutingContext = {
    workspaceId: string;
    graphId: string;
    /** Kletron user id for workspace context / audit; falls back to workspace owner when unset. */
    kletronUserId: string;
    threadApprovalMode?: ThreadApprovalMode;
};

export type ChannelRunSource = `channel:${ChannelId}`;

export function channelRunSource(ch: ChannelId): ChannelRunSource {
    return `channel:${ch}`;
}
