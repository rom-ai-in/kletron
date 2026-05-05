/**
 * Serial in-process queue for channel webhook handlers (legacy helper).
 * Telegram uses {@link enqueueTelegramInboundJob} + Mongo `channel_inbound_jobs` by default.
 */
type Job = () => Promise<void>;

const queue: Job[] = [];
let processing = false;

export function enqueueChannelJob(job: Job): void {
    queue.push(job);
    void drain();
}

async function drain(): Promise<void> {
    if (processing) return;
    processing = true;
    try {
        while (queue.length > 0) {
            const job = queue.shift();
            if (job) {
                try {
                    await job();
                } catch (e) {
                    console.error("[ChannelQueue] job error:", (e as Error)?.message ?? e);
                }
            }
        }
    } finally {
        processing = false;
    }
}
