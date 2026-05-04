/**
 * Optional gate for agent tools that mutate instance-wide settings (LLM, embeddings,
 * tool-approval policy, global Telegram app credentials). Reads are always allowed.
 */
export function assertKletronAgentInstanceConfigWritesAllowed(feature: string): void {
    if (process.env.KLETRON_AGENT_ALLOW_INSTANCE_CONFIG?.trim() !== "1") {
        throw new Error(
            `Instance-wide config writes are disabled (${feature}). Set KLETRON_AGENT_ALLOW_INSTANCE_CONFIG=1 on the server to enable agent tools that change LLM, embedding, tool-approval, or app messenger credentials.`
        );
    }
}
