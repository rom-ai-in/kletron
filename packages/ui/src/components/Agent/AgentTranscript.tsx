import type { ComponentProps } from "react";
import { MessageList } from "./MessageList";

export type AgentTranscriptMode = "chat" | "timeline";

type MessageListProps = ComponentProps<typeof MessageList>;

/**
 * Shared transcript shell: `chat` forwards to {@link MessageList}.
 * `timeline` is reserved for EventCard + timeline parity with the web agent page.
 */
export function AgentTranscript(
  props: MessageListProps & {
    mode?: AgentTranscriptMode;
  }
) {
  const { mode = "chat", ...rest } = props;
  if (mode === "timeline") {
    return (
      <div className="text-xs text-text-muted px-2 py-4">
        Timeline transcript mode is not wired in this build — use <code>mode=&quot;chat&quot;</code> or the web agent page.
      </div>
    );
  }
  return <MessageList {...rest} />;
}
