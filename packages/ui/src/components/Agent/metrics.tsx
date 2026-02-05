import { useEffect, useState } from "react";

export type TokenUsageSummary = {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  callCount?: number;
  model?: string;
};

/** Format token count to human readable string (e.g., 1.2k, 15k) */
export function formatTokenCount(count: number): string {
  if (count < 1000) return String(count);
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  return `${Math.round(count / 1000)}k`;
}

/**
 * Format duration between two timestamps, or elapsed time from start to now.
 * Returns human-readable string like "2.3s", "1m 12s", "5m 30s"
 */
export function formatDuration(startedAt?: string, endedAt?: string): string {
  if (!startedAt) return "";
  try {
    const start = new Date(startedAt).getTime();
    const end = endedAt ? new Date(endedAt).getTime() : Date.now();
    const diffMs = Math.max(0, end - start);
    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((diffMs % 1000) / 100);

    if (minutes === 0) {
      return `${seconds}.${tenths}s`;
    }
    return `${minutes}m ${seconds}s`;
  } catch {
    return "";
  }
}

/** Token usage display component */
export function TokenUsageDisplay({
  tokenUsage,
  className,
  showLabel = true,
}: {
  tokenUsage?: TokenUsageSummary | null;
  className?: string;
  showLabel?: boolean;
}) {
  if (!tokenUsage || tokenUsage.totalTokens === 0) return null;

  return (
    <div className={`flex items-center gap-1.5 text-[10px] font-mono ${className ?? ""}`}>
      <svg className="h-3 w-3 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span
        className="text-emerald-400"
        title={`${tokenUsage.totalInputTokens} input + ${tokenUsage.totalOutputTokens} output tokens`}
      >
        {formatTokenCount(tokenUsage.totalTokens)}
      </span>
      {showLabel && <span className="text-text-muted">tokens</span>}
    </div>
  );
}

/** Live updating duration display */
export function DurationDisplay({
  startedAt,
  endedAt,
  className,
}: {
  startedAt?: string | null;
  endedAt?: string | null;
  className?: string;
}) {
  const [elapsed, setElapsed] = useState(() => formatDuration(startedAt ?? undefined, endedAt ?? undefined));

  useEffect(() => {
    if (!startedAt) {
      setElapsed("");
      return;
    }
    if (endedAt) {
      setElapsed(formatDuration(startedAt, endedAt));
      return;
    }
    setElapsed(formatDuration(startedAt));
    const interval = setInterval(() => {
      setElapsed(formatDuration(startedAt));
    }, 500);
    return () => clearInterval(interval);
  }, [startedAt, endedAt]);

  if (!startedAt) return null;

  return (
    <span className={`text-[10px] font-mono text-text-muted ${className ?? ""}`}>
      {elapsed}
    </span>
  );
}
