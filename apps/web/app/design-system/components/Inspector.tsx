"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

import { Button } from "@numezis/ui/components/design-system";
import type { ComponentDoc } from "../docs";

type InspectorContextValue = {
    openInspector: (doc: ComponentDoc) => void;
    closeInspector: () => void;
};

const InspectorContext = createContext<InspectorContextValue | null>(null);

export function InspectorProvider({ children }: { children: ReactNode }) {
    const [doc, setDoc] = useState<ComponentDoc | null>(null);

    const value = useMemo(
        () => ({
            openInspector: (nextDoc: ComponentDoc) => setDoc(nextDoc),
            closeInspector: () => setDoc(null),
        }),
        []
    );

    return (
        <InspectorContext.Provider value={value}>
            {children}
            {doc ? <InspectorPanel doc={doc} onClose={() => setDoc(null)} /> : null}
        </InspectorContext.Provider>
    );
}

export function useInspector() {
    const context = useContext(InspectorContext);
    if (!context) {
        throw new Error("useInspector must be used within InspectorProvider");
    }
    return context;
}

export function InspectButton({ doc }: { doc: ComponentDoc }) {
    const { openInspector } = useInspector();

    return (
        <Button size="xs" variant="ghost" onClick={() => openInspector(doc)}>
            Inspect
        </Button>
    );
}

function InspectorPanel({ doc, onClose }: { doc: ComponentDoc; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-[120]">
            <button
                type="button"
                aria-label="Close inspector"
                onClick={onClose}
                className="absolute inset-0 bg-black/40"
            />
            <aside className="absolute right-0 top-0 h-full w-full max-w-[420px] bg-bg-surface border-l border-border-subtle shadow-2xl flex flex-col">
                <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-4">
                    <div>
                        <div className="text-sm font-semibold text-text-primary">{doc.name}</div>
                        <div className="text-xs text-text-muted mt-1">{doc.summary}</div>
                    </div>
                    <Button size="xs" variant="ghost" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
                    <InspectorSection title="Usage">
                        <CodeBlock code={doc.usage} />
                    </InspectorSection>

                    <InspectorSection title="Props">
                        <List items={doc.props} />
                    </InspectorSection>

                    <InspectorSection title="Tokens">
                        <List items={doc.tokens} />
                    </InspectorSection>

                    {doc.variants && doc.variants.length > 0 ? (
                        <InspectorSection title="Variants">
                            <List items={doc.variants} />
                        </InspectorSection>
                    ) : null}

                    {doc.states && doc.states.length > 0 ? (
                        <InspectorSection title="States">
                            <List items={doc.states} />
                        </InspectorSection>
                    ) : null}

                    {doc.notes && doc.notes.length > 0 ? (
                        <InspectorSection title="Notes">
                            <List items={doc.notes} />
                        </InspectorSection>
                    ) : null}
                </div>
            </aside>
        </div>
    );
}

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-widest text-text-muted">{title}</div>
            {children}
        </div>
    );
}

function List({ items }: { items: string[] }) {
    return (
        <ul className="space-y-1 text-xs text-text-secondary">
            {items.map((item) => (
                <li key={item} className="leading-relaxed">• {item}</li>
            ))}
        </ul>
    );
}

function CodeBlock({ code }: { code: string }) {
    return (
        <pre className="rounded-lg border border-border-subtle bg-bg-app p-3 text-xs text-text-secondary overflow-x-auto">
            <code>{code}</code>
        </pre>
    );
}
