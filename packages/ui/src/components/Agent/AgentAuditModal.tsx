
import React, { useEffect, useState } from 'react';
import { X, Copy, Check, Terminal } from 'lucide-react';
import { Modal } from '@kletron/ui/components/design-system';

export interface AgentAuditModalProps {
    open: boolean;
    onClose: () => void;
    conversationId: string;
}

export const AgentAuditModal: React.FC<AgentAuditModalProps> = ({ open, onClose, conversationId }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open && conversationId) {
            setLoading(true);
            setError(null);
            // Fetch the full run data. We might need a specific run endpoint or just use the agent endpoint
            // which likely returns the full session object.
            fetch(`/api/sessions/${conversationId}`)
                .then(res => {
                    if (!res.ok) throw new Error("Failed to fetch audit logs");
                    return res.json();
                })
                .then(json => setData(json))
                .catch(err => setError(err.message))
                .finally(() => setLoading(false));
        }
    }, [open, conversationId]);

    const handleCopy = () => {
        if (data) {
            navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        }
    };

    return (
        <Modal open={open} onClose={onClose} title="Agent Audit Logs" subtitle={conversationId} fullHeight>
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between p-2 border-b border-border-subtle bg-bg-surface">
                    <div className="text-xs text-text-muted">
                        Unfiltered JSON view of the agent session, including System Prompt & Context.
                    </div>
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-text-primary bg-bg-elevated border border-border-subtle rounded hover:bg-state-hover transition-colors"
                    >
                        <Copy size={12} /> Copy JSON
                    </button>
                </div>

                <div className="flex-1 overflow-auto bg-bg-app p-4 font-mono text-xs">
                    {loading && <div className="text-status-info-text">Loading audit trace...</div>}
                    {error && <div className="text-status-error-text">Error: {error}</div>}

                    {!loading && !error && data && (
                        <pre className="text-gray-300 whitespace-pre-wrap break-all">
                            {JSON.stringify(data, null, 2)}
                        </pre>
                    )}
                </div>
            </div>
        </Modal>
    );
};
