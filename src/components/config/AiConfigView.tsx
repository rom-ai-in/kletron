"use client";

import { Brain, Cpu, Database } from "lucide-react";
import { Tabs, TabsList, TabTrigger, TabContent } from "@/src/components/design-system";
import { LlmConfigView } from "./LlmConfigView";
import { EmbeddingConfigView } from "./EmbeddingConfigView";

type TabId = "llm" | "embedding";

interface AiConfigViewProps {
    initialTab?: TabId;
}

export function AiConfigView({ initialTab = "llm" }: AiConfigViewProps) {
    return (
        <Tabs defaultValue={initialTab} variant="underline" className="flex h-full flex-col bg-bg-app overflow-hidden">
            {/* Unified Header */}
            <div className="shrink-0 border-b border-border-subtle bg-bg-surface">
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-state-success/20 to-state-info/20">
                            <Brain className="h-6 w-6 text-text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-text-primary">AI Configuration</h1>
                            <p className="text-sm text-text-muted">Manage AI providers and model settings</p>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <TabsList className="px-6 gap-6 -mb-px">
                    <TabTrigger value="llm" className="flex items-center gap-2 py-3">
                        <Cpu className="h-4 w-4" />
                        <span className="font-medium">LLM Models</span>
                        <span className="hidden sm:inline text-xs text-text-muted">· Chat & generation</span>
                    </TabTrigger>
                    <TabTrigger value="embedding" className="flex items-center gap-2 py-3">
                        <Database className="h-4 w-4" />
                        <span className="font-medium">Embeddings</span>
                        <span className="hidden sm:inline text-xs text-text-muted">· Vector search</span>
                    </TabTrigger>
                </TabsList>
            </div>

            {/* Tab Content - Takes remaining height */}
            <TabContent value="llm" className="mt-0 flex-1 overflow-hidden">
                <LlmConfigView hideHeader />
            </TabContent>
            <TabContent value="embedding" className="mt-0 flex-1 overflow-hidden">
                <EmbeddingConfigView hideHeader />
            </TabContent>
        </Tabs>
    );
}
