"use client";

import Link from "next/link";
import { ArrowLeft, MessagesSquare } from "lucide-react";
import { ChannelsConfigView } from "@kletron/ui/components/config/ChannelsConfigView";

export default function ChannelsConfigPage() {
  return (
    <div className="flex h-full flex-col bg-bg-app overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/app/config">
            <button
              type="button"
              className="flex items-center justify-center rounded-md p-2 text-text-muted hover:bg-bg-component-hover hover:text-text-primary transition-colors"
              aria-label="Back to configuration"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-main/10 text-primary-main">
              <MessagesSquare className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-text-primary truncate">Messenger channels</h1>
              <p className="text-sm text-text-muted">
                Telegram, Slack, and WhatsApp webhooks for agents. Tokens live on the server, not in this UI.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-elegant">
        <div className="mx-auto max-w-3xl">
          <ChannelsConfigView />
        </div>
      </div>
    </div>
  );
}
