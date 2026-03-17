"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Plus,
    Pencil,
    Trash2,
    Save,
    Users,
    Swords,
    Lightbulb,
    Briefcase,
    Eye,
    X,
    Target,
    Sparkles,
    Settings,
} from "lucide-react";
import { Panel, Button, Badge } from "@kletron/ui/components/design-system";
import type { BusinessContext, UserPersona, Competitor } from "@kletron/shared/businessContext";

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchContext(): Promise<BusinessContext> {
    const res = await fetch("/api/business-analyst/context");
    if (!res.ok) throw new Error("Failed to fetch business context");
    const data = await res.json();
    return data.context ?? { personas: [], competitors: [] };
}

async function updateContext(updates: Partial<BusinessContext>): Promise<void> {
    const res = await fetch("/api/business-analyst/context", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update business context");
}

async function addPersona(persona: Omit<UserPersona, "id">): Promise<string> {
    const res = await fetch("/api/business-analyst/context/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(persona),
    });
    if (!res.ok) throw new Error("Failed to add persona");
    return (await res.json()).personaId;
}

async function deletePersonaApi(id: string): Promise<void> {
    const res = await fetch(`/api/business-analyst/context/personas/${id}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete persona");
}

async function addCompetitor(competitor: Omit<Competitor, "id">): Promise<string> {
    const res = await fetch("/api/business-analyst/context/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(competitor),
    });
    if (!res.ok) throw new Error("Failed to add competitor");
    return (await res.json()).competitorId;
}

async function deleteCompetitorApi(id: string): Promise<void> {
    const res = await fetch(`/api/business-analyst/context/competitors/${id}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete competitor");
}

// ---------------------------------------------------------------------------
// Tag Input Component
// ---------------------------------------------------------------------------

function TagInput({
    value,
    onChange,
    placeholder,
}: {
    value: string[];
    onChange: (tags: string[]) => void;
    placeholder?: string;
}) {
    const [input, setInput] = useState("");

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && input.trim()) {
            e.preventDefault();
            if (!value.includes(input.trim())) {
                onChange([...value, input.trim()]);
            }
            setInput("");
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
                {value.map((tag, i) => (
                    <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-elevated text-text-secondary text-xs border border-border-subtle"
                    >
                        {tag}
                        <button
                            onClick={() => onChange(value.filter((_, j) => j !== i))}
                            className="text-text-muted hover:text-text-primary"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}
            </div>
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Persona Card
// ---------------------------------------------------------------------------

function PersonaCard({
    persona,
    onDelete,
}: {
    persona: UserPersona;
    onDelete: () => void;
}) {
    return (
        <Panel className="p-4 border border-border-subtle">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-text-primary truncate">
                            {persona.name}
                        </h4>
                        <Badge variant="outline" size="xs">{persona.role}</Badge>
                    </div>
                    <div className="flex gap-2 mb-2">
                        <Badge size="xs" variant={
                            persona.techSavviness === "high" ? "success" :
                            persona.techSavviness === "medium" ? "warning" : "info"
                        }>
                            {persona.techSavviness} tech
                        </Badge>
                        <Badge size="xs" variant="outline">{persona.frequency}</Badge>
                    </div>
                    {persona.goals.length > 0 && (
                        <div className="mb-1.5">
                            <p className="text-[10px] font-semibold uppercase text-text-muted tracking-wider mb-0.5">Goals</p>
                            <ul className="text-xs text-text-secondary space-y-0.5">
                                {persona.goals.map((g, i) => (
                                    <li key={i} className="flex items-start gap-1">
                                        <Target className="h-3 w-3 mt-0.5 text-status-success-text shrink-0" />
                                        {g}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {persona.painPoints.length > 0 && (
                        <div>
                            <p className="text-[10px] font-semibold uppercase text-text-muted tracking-wider mb-0.5">Pain Points</p>
                            <ul className="text-xs text-text-secondary space-y-0.5">
                                {persona.painPoints.map((p, i) => (
                                    <li key={i} className="flex items-start gap-1">
                                        <span className="text-status-error-text shrink-0">-</span>
                                        {p}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {persona.quote && (
                        <p className="mt-2 text-xs italic text-text-muted">&ldquo;{persona.quote}&rdquo;</p>
                    )}
                </div>
                <button
                    onClick={onDelete}
                    className="p-1 rounded text-text-muted hover:text-status-error-text hover:bg-status-error-bg transition-colors"
                    title="Delete persona"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
        </Panel>
    );
}

// ---------------------------------------------------------------------------
// Competitor Card
// ---------------------------------------------------------------------------

function CompetitorCard({
    competitor,
    onDelete,
}: {
    competitor: Competitor;
    onDelete: () => void;
}) {
    return (
        <Panel className="p-4 border border-border-subtle">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-text-primary truncate">
                            {competitor.name}
                        </h4>
                        {competitor.url && (
                            <a
                                href={competitor.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-text-muted hover:text-text-secondary"
                            >
                                {(() => { try { return new URL(competitor.url).hostname; } catch { return competitor.url; } })()}
                            </a>
                        )}
                    </div>
                    <p className="text-xs text-text-secondary mb-2">{competitor.description}</p>
                    {competitor.strengths.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                            {competitor.strengths.map((s, i) => (
                                <Badge key={i} size="xs" variant="success">{s}</Badge>
                            ))}
                        </div>
                    )}
                    {competitor.weaknesses.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {competitor.weaknesses.map((w, i) => (
                                <Badge key={i} size="xs" variant="error">{w}</Badge>
                            ))}
                        </div>
                    )}
                </div>
                <button
                    onClick={onDelete}
                    className="p-1 rounded text-text-muted hover:text-status-error-text hover:bg-status-error-bg transition-colors"
                    title="Delete competitor"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
        </Panel>
    );
}

// ---------------------------------------------------------------------------
// Add Persona Modal
// ---------------------------------------------------------------------------

function AddPersonaForm({
    onAdd,
    onCancel,
}: {
    onAdd: (persona: Omit<UserPersona, "id">) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState("");
    const [role, setRole] = useState("");
    const [goals, setGoals] = useState<string[]>([]);
    const [painPoints, setPainPoints] = useState<string[]>([]);
    const [techSavviness, setTechSavviness] = useState<"low" | "medium" | "high">("medium");
    const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly" | "occasional">("weekly");
    const [quote, setQuote] = useState("");

    const canSubmit = name.trim() && role.trim() && goals.length > 0;

    return (
        <Panel className="p-4 border border-border-strong bg-bg-elevated">
            <h4 className="text-sm font-semibold text-text-primary mb-3">Add Persona</h4>
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[11px] font-medium text-text-muted mb-1">Name *</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Marie, Senior PM"
                            className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-medium text-text-muted mb-1">Role *</label>
                        <input
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            placeholder="Product Manager"
                            className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[11px] font-medium text-text-muted mb-1">Tech Savviness</label>
                        <select
                            value={techSavviness}
                            onChange={(e) => setTechSavviness(e.target.value as any)}
                            className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-1.5 text-sm text-text-primary focus:border-border-strong focus:outline-none"
                        >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-medium text-text-muted mb-1">Usage Frequency</label>
                        <select
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value as any)}
                            className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-1.5 text-sm text-text-primary focus:border-border-strong focus:outline-none"
                        >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="occasional">Occasional</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-[11px] font-medium text-text-muted mb-1">Goals * (press Enter to add)</label>
                    <TagInput value={goals} onChange={setGoals} placeholder="What does this persona want to achieve?" />
                </div>
                <div>
                    <label className="block text-[11px] font-medium text-text-muted mb-1">Pain Points (press Enter to add)</label>
                    <TagInput value={painPoints} onChange={setPainPoints} placeholder="Current frustrations" />
                </div>
                <div>
                    <label className="block text-[11px] font-medium text-text-muted mb-1">Quote (optional)</label>
                    <input
                        value={quote}
                        onChange={(e) => setQuote(e.target.value)}
                        placeholder="A representative quote"
                        className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                    />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                    <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
                    <Button
                        size="sm"
                        disabled={!canSubmit}
                        onClick={() =>
                            onAdd({ name, role, goals, painPoints, techSavviness, frequency, quote: quote || undefined })
                        }
                    >
                        Add Persona
                    </Button>
                </div>
            </div>
        </Panel>
    );
}

// ---------------------------------------------------------------------------
// Add Competitor Form
// ---------------------------------------------------------------------------

function AddCompetitorForm({
    onAdd,
    onCancel,
}: {
    onAdd: (competitor: Omit<Competitor, "id">) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState("");
    const [url, setUrl] = useState("");
    const [description, setDescription] = useState("");
    const [strengths, setStrengths] = useState<string[]>([]);
    const [weaknesses, setWeaknesses] = useState<string[]>([]);
    const [pricing, setPricing] = useState("");

    const canSubmit = name.trim() && description.trim();

    return (
        <Panel className="p-4 border border-border-strong bg-bg-elevated">
            <h4 className="text-sm font-semibold text-text-primary mb-3">Add Competitor</h4>
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[11px] font-medium text-text-muted mb-1">Name *</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Competitor name"
                            className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-medium text-text-muted mb-1">URL</label>
                        <input
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://competitor.com"
                            className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-[11px] font-medium text-text-muted mb-1">Description *</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief description of the competitor"
                        rows={2}
                        className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none resize-none"
                    />
                </div>
                <div>
                    <label className="block text-[11px] font-medium text-text-muted mb-1">Strengths (press Enter)</label>
                    <TagInput value={strengths} onChange={setStrengths} placeholder="e.g. Great UX" />
                </div>
                <div>
                    <label className="block text-[11px] font-medium text-text-muted mb-1">Weaknesses (press Enter)</label>
                    <TagInput value={weaknesses} onChange={setWeaknesses} placeholder="e.g. Expensive" />
                </div>
                <div>
                    <label className="block text-[11px] font-medium text-text-muted mb-1">Pricing</label>
                    <input
                        value={pricing}
                        onChange={(e) => setPricing(e.target.value)}
                        placeholder="e.g. $29/mo, Freemium"
                        className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                    />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                    <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
                    <Button
                        size="sm"
                        disabled={!canSubmit}
                        onClick={() =>
                            onAdd({
                                name,
                                url: url || undefined,
                                description,
                                strengths,
                                weaknesses,
                                pricing: pricing || undefined,
                            })
                        }
                    >
                        Add Competitor
                    </Button>
                </div>
            </div>
        </Panel>
    );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function BAConfigView() {
    const [context, setContext] = useState<BusinessContext | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showAddPersona, setShowAddPersona] = useState(false);
    const [showAddCompetitor, setShowAddCompetitor] = useState(false);

    // Editable fields
    const [productVision, setProductVision] = useState("");
    const [valueProposition, setValueProposition] = useState("");
    const [marketPositioning, setMarketPositioning] = useState("");
    const [targetMarketSegments, setTargetMarketSegments] = useState<string[]>([]);
    const [revenueModel, setRevenueModel] = useState("");
    const [pricingStrategy, setPricingStrategy] = useState("");
    const [innovationAxes, setInnovationAxes] = useState<string[]>([]);
    const [techDifferentiators, setTechDifferentiators] = useState<string[]>([]);

    const load = useCallback(async () => {
        try {
            const ctx = await fetchContext();
            setContext(ctx);
            setProductVision(ctx.productVision ?? "");
            setValueProposition(ctx.valueProposition ?? "");
            setMarketPositioning(ctx.marketPositioning ?? "");
            setTargetMarketSegments(ctx.targetMarketSegments ?? []);
            setRevenueModel(ctx.revenueModel ?? "");
            setPricingStrategy(ctx.pricingStrategy ?? "");
            setInnovationAxes(ctx.innovationAxes ?? []);
            setTechDifferentiators(ctx.techDifferentiators ?? []);
        } catch (e) {
            console.error("Failed to load business context:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateContext({
                productVision,
                valueProposition,
                marketPositioning,
                targetMarketSegments,
                revenueModel,
                pricingStrategy,
                innovationAxes,
                techDifferentiators,
            });
            await load();
        } catch (e) {
            console.error("Failed to save:", e);
        } finally {
            setSaving(false);
        }
    };

    const handleAddPersona = async (persona: Omit<UserPersona, "id">) => {
        try {
            await addPersona(persona);
            setShowAddPersona(false);
            await load();
        } catch (e) {
            console.error("Failed to add persona:", e);
        }
    };

    const handleDeletePersona = async (id: string) => {
        try {
            await deletePersonaApi(id);
            await load();
        } catch (e) {
            console.error("Failed to delete persona:", e);
        }
    };

    const handleAddCompetitor = async (competitor: Omit<Competitor, "id">) => {
        try {
            await addCompetitor(competitor);
            setShowAddCompetitor(false);
            await load();
        } catch (e) {
            console.error("Failed to add competitor:", e);
        }
    };

    const handleDeleteCompetitor = async (id: string) => {
        try {
            await deleteCompetitorApi(id);
            await load();
        } catch (e) {
            console.error("Failed to delete competitor:", e);
        }
    };

    return (
        <div className="flex h-full flex-col bg-bg-app overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated text-text-muted">
                        <Settings className="h-4 w-4" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-text-primary">BA Configuration</h1>
                        <p className="text-sm text-text-muted">
                            Define your product vision, user personas, and competitors
                        </p>
                    </div>
                </div>
                <Button onClick={handleSave} disabled={saving || loading}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Saving..." : "Save Configuration"}
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-elegant">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-sm text-text-muted animate-pulse">Loading business context...</div>
                    </div>
                ) : (
                <div className="space-y-8">
            {/* Product Vision & Strategy */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <Eye className="h-4 w-4 text-text-muted" />
                    <h3 className="text-base font-semibold text-text-primary">Product Vision & Strategy</h3>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">Product Vision</label>
                        <textarea
                            value={productVision}
                            onChange={(e) => setProductVision(e.target.value)}
                            placeholder="Describe your long-term product vision..."
                            rows={3}
                            className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none resize-none"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-1">Value Proposition</label>
                            <input
                                value={valueProposition}
                                onChange={(e) => setValueProposition(e.target.value)}
                                placeholder="What unique value do you provide?"
                                className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-1">Market Positioning</label>
                            <input
                                value={marketPositioning}
                                onChange={(e) => setMarketPositioning(e.target.value)}
                                placeholder="How do you position vs. the market?"
                                className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">Target Market Segments (press Enter)</label>
                        <TagInput value={targetMarketSegments} onChange={setTargetMarketSegments} placeholder="e.g. SaaS startups, Enterprise" />
                    </div>
                </div>
            </section>

            {/* Business Model */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <Briefcase className="h-4 w-4 text-text-muted" />
                    <h3 className="text-base font-semibold text-text-primary">Business Model</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">Revenue Model</label>
                        <input
                            value={revenueModel}
                            onChange={(e) => setRevenueModel(e.target.value)}
                            placeholder="e.g. SaaS, Freemium, Marketplace"
                            className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">Pricing Strategy</label>
                        <input
                            value={pricingStrategy}
                            onChange={(e) => setPricingStrategy(e.target.value)}
                            placeholder="e.g. Usage-based, Per-seat, Tiered"
                            className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                        />
                    </div>
                </div>
            </section>

            {/* Innovation & Differentiation */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-4 w-4 text-text-muted" />
                    <h3 className="text-base font-semibold text-text-primary">Innovation & Differentiation</h3>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">Innovation Axes (press Enter)</label>
                        <TagInput value={innovationAxes} onChange={setInnovationAxes} placeholder="e.g. AI-first, Real-time collaboration" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">Technical Differentiators (press Enter)</label>
                        <TagInput value={techDifferentiators} onChange={setTechDifferentiators} placeholder="e.g. Edge computing, LLM orchestration" />
                    </div>
                </div>
            </section>

            {/* User Personas */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-text-muted" />
                        <h3 className="text-base font-semibold text-text-primary">User Personas</h3>
                        <Badge size="xs" variant="outline">{context?.personas.length ?? 0}</Badge>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => setShowAddPersona(true)}>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add Persona
                    </Button>
                </div>
                {showAddPersona && (
                    <div className="mb-4">
                        <AddPersonaForm
                            onAdd={handleAddPersona}
                            onCancel={() => setShowAddPersona(false)}
                        />
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {context?.personas.map((persona) => (
                        <PersonaCard
                            key={persona.id}
                            persona={persona}
                            onDelete={() => handleDeletePersona(persona.id)}
                        />
                    ))}
                </div>
                {(!context?.personas.length && !showAddPersona) && (
                    <Panel className="p-6 border border-border-subtle text-center">
                        <Users className="h-6 w-6 text-text-muted mx-auto mb-2" />
                        <p className="text-sm text-text-muted">No personas defined yet. Add your first user persona to guide feature generation.</p>
                    </Panel>
                )}
            </section>

            {/* Competitors */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Swords className="h-4 w-4 text-text-muted" />
                        <h3 className="text-base font-semibold text-text-primary">Competitors</h3>
                        <Badge size="xs" variant="outline">{context?.competitors.length ?? 0}</Badge>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => setShowAddCompetitor(true)}>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add Competitor
                    </Button>
                </div>
                {showAddCompetitor && (
                    <div className="mb-4">
                        <AddCompetitorForm
                            onAdd={handleAddCompetitor}
                            onCancel={() => setShowAddCompetitor(false)}
                        />
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {context?.competitors.map((competitor) => (
                        <CompetitorCard
                            key={competitor.id}
                            competitor={competitor}
                            onDelete={() => handleDeleteCompetitor(competitor.id)}
                        />
                    ))}
                </div>
                {(!context?.competitors.length && !showAddCompetitor) && (
                    <Panel className="p-6 border border-border-subtle text-center">
                        <Swords className="h-6 w-6 text-text-muted mx-auto mb-2" />
                        <p className="text-sm text-text-muted">No competitors defined yet. Add competitors to enable competitive analysis.</p>
                    </Panel>
                )}
            </section>
                </div>
                )}
            </div>
        </div>
    );
}
