import React, { useEffect, useState, useRef } from 'react';
import { useEditorState } from '../../context/EditorContext';
import { AlertCircle, Activity, ChevronDown, Check, X } from 'lucide-react';
import { graphOptions } from '../../shared/graphCatalog';

type LlmEnvInfo = {
    defaultProvider?: "azure" | "lmstudio";
    azure?: {
        configured: boolean;
        endpoint?: string | null;
        deployment?: string | null;
        model?: string | null;
        apiVersion?: string | null;
    };
    lmstudio?: {
        configured: boolean;
        baseUrl?: string | null;
        model?: string | null;
    };
};

import { Selector } from '../ui/Selector';

export const AgentStatusBar: React.FC = () => {
    const { state } = useEditorState();
    const activeAgentCount = Object.keys(state.cursors).length;
    const pendingDiffCount = Object.values(state.pendingDiffs).flat().length;
    // @ts-ignore
    const conflicts = Object.values(state.pendingDiffs).flat().filter(d => d.status === 'conflict').length;

    const [llmProvider, setLlmProvider] = useState<string>('azure');
    const [selectedGraphId, setSelectedGraphId] = useState<string>(graphOptions[0]?.id || 'universal-v1');
    const [envInfo, setEnvInfo] = useState<LlmEnvInfo | null>(null);

    useEffect(() => {
        const fetchEnv = async () => {
            try {
                const res = await fetch("/api/env");
                const data = await res.json();
                const envLLM = data.llm as LlmEnvInfo;
                setEnvInfo(envLLM);

                // Initialize from Env or LocalStorage
                const stored = window.localStorage.getItem("numezis-llm-selection");
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        if (parsed.provider) setLlmProvider(parsed.provider);
                    } catch { }
                } else {
                    setLlmProvider(envLLM?.defaultProvider || 'azure');
                }

                const storedGraph = window.localStorage.getItem("numezis-graph-selection");
                if (storedGraph) {
                    setSelectedGraphId(storedGraph);
                }

            } catch (e) {
                console.error("Failed to fetch env", e);
            }
        };
        fetchEnv();
    }, []);

    const handleLlmChange = (provider: string) => {
        setLlmProvider(provider);
        window.localStorage.setItem("numezis-llm-selection", JSON.stringify({ provider, model: provider === 'azure' ? envInfo?.azure?.model : envInfo?.lmstudio?.model }));
        // Trigger a reload or context update if necessary - currently just UI state
        // In a real app we might want to update a global context
    };

    const handleGraphChange = (graphId: string) => {
        setSelectedGraphId(graphId);
        window.localStorage.setItem("numezis-graph-selection", graphId);
    };

    const llmOptions = [
        {
            id: 'azure',
            label: 'Azure OpenAI',
            sub: envInfo?.azure?.model || 'Not configured'
        },
        {
            id: 'lmstudio',
            label: 'LM Studio',
            sub: envInfo?.lmstudio?.model || 'Not configured'
        }
    ];

    const graphSelectOptions = graphOptions.map(g => ({
        id: g.id,
        label: g.name,
        sub: g.description
    }));

    return (
        <div className="h-12 bg-black/40 backdrop-blur-md border-t border-white/5 flex items-center px-4 justify-between select-none">
            {/* Left Status Indicators */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                    <Activity className="w-3.5 h-3.5" />
                    <span>{activeAgentCount} Agents</span>
                </div>
                {pendingDiffCount > 0 && (
                    <div className="flex items-center gap-2 text-xs font-medium text-blue-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        <span>{pendingDiffCount} Diffs</span>
                    </div>
                )}
                {conflicts > 0 && (
                    <div className="flex items-center gap-2 text-xs font-bold text-red-400 animate-pulse">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{conflicts} CONFLICTS</span>
                    </div>
                )}
            </div>


        </div>
    );
};
