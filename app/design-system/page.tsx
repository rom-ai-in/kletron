"use client";

import { useState } from "react";
import {
    Check, AlertCircle, Loader2, ChevronRight, ChevronDown, Copy, Settings, User, Zap, FileCode, Play, Pause,
    CheckCircle2, XCircle, Clock, Folder, File, Terminal, Database, Share2, Layers, Globe, History,
    Edit3, Trash2, MoreHorizontal, Search, Command, Plus, Home, LogOut, X, MessageSquare, List,
    RefreshCw, ArrowUp, Cpu, BarChart3, Brain, Wrench, FileText, GitBranch, Eye, Code2, CheckCheck, XOctagon, RotateCcw
} from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { Panel } from "@/src/components/ui/Panel";
import { Modal } from "@/src/components/ui/Modal";
import { Skeleton } from "@/src/components/ui/Skeleton";

const TABS = ["Foundation", "Components", "Patterns", "Extension", "AI Patterns"] as const;
type TabType = typeof TABS[number];

export default function DesignSystemPage() {
    const [activeTab, setActiveTab] = useState<TabType>("Foundation");
    const [showModal, setShowModal] = useState(false);
    const [extensionTab, setExtensionTab] = useState<'chat' | 'runs' | 'settings'>('chat');
    const [thoughtsExpanded, setThoughtsExpanded] = useState(true);
    const [toolsExpanded, setToolsExpanded] = useState(true);
    const [diffStates, setDiffStates] = useState<Record<string, 'pending' | 'approved' | 'rejected'>>({
        'diff-1': 'pending', 'diff-2': 'pending', 'diff-3': 'pending',
    });

    const handleApprove = (id: string) => setDiffStates(prev => ({ ...prev, [id]: 'approved' }));
    const handleReject = (id: string) => setDiffStates(prev => ({ ...prev, [id]: 'rejected' }));
    const handleApproveAll = () => setDiffStates({ 'diff-1': 'approved', 'diff-2': 'approved', 'diff-3': 'approved' });
    const handleRejectAll = () => setDiffStates({ 'diff-1': 'rejected', 'diff-2': 'rejected', 'diff-3': 'rejected' });

    return (
        <div className="min-h-screen bg-bg-app">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-border-subtle bg-bg-surface/80 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🧠</span>
                        <div>
                            <h1 className="text-lg font-semibold text-text-primary">Numezis Design System</h1>
                            <p className="text-xs text-text-muted">Complete UI Reference • v3.0</p>
                        </div>
                    </div>
                    <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">v3.0</span>
                </div>
            </header>

            {/* Tab Navigation */}
            <nav className="sticky top-[73px] z-30 border-b border-border-subtle bg-bg-surface">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex gap-1 py-2">
                        {TABS.map((tab) => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tab
                                        ? 'bg-state-selected text-text-primary border border-border-strong'
                                        : 'text-text-secondary hover:text-text-primary hover:bg-state-hover'
                                    }`}>
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-8">

                {/* ========== FOUNDATION TAB ========== */}
                {activeTab === "Foundation" && (
                    <div className="space-y-12">
                        {/* Colors */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Color Tokens</h2>
                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-3">
                                    <h3 className="text-sm font-medium text-text-secondary">Backgrounds</h3>
                                    <div className="space-y-2">
                                        {[
                                            { name: "--bg-app", class: "bg-bg-app", desc: "Zinc 950" },
                                            { name: "--bg-surface", class: "bg-bg-surface", desc: "Zinc 900" },
                                            { name: "--bg-elevated", class: "bg-bg-elevated", desc: "Zinc 800" },
                                        ].map((t) => (
                                            <div key={t.name} className="flex items-center gap-3 p-2 rounded border border-border-subtle">
                                                <div className={`w-10 h-10 rounded ${t.class} border border-border-subtle`} />
                                                <div>
                                                    <p className="text-xs font-mono text-text-primary">{t.name}</p>
                                                    <p className="text-[10px] text-text-muted">{t.desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <h3 className="text-sm font-medium text-text-secondary">Semantic</h3>
                                    <div className="space-y-2">
                                        {[
                                            { name: "emerald-500", class: "bg-emerald-500", desc: "Success" },
                                            { name: "rose-500", class: "bg-rose-500", desc: "Error/Danger" },
                                            { name: "zinc-400", class: "bg-zinc-400", desc: "Neutral/Muted" },
                                        ].map((t) => (
                                            <div key={t.name} className="flex items-center gap-3 p-2 rounded border border-border-subtle">
                                                <div className={`w-10 h-10 rounded ${t.class}`} />
                                                <div>
                                                    <p className="text-xs font-mono text-text-primary">{t.name}</p>
                                                    <p className="text-[10px] text-text-muted">{t.desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Typography */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Typography</h2>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface space-y-4">
                                <p className="text-2xl font-bold text-text-primary">Heading XL (text-2xl)</p>
                                <p className="text-xl font-semibold text-text-primary">Heading L (text-xl)</p>
                                <p className="text-lg font-medium text-text-primary">Heading M (text-lg)</p>
                                <p className="text-sm text-text-primary">Body (text-sm)</p>
                                <p className="text-xs text-text-secondary">Small (text-xs)</p>
                                <p className="text-[10px] text-text-muted">Tiny (text-[10px])</p>
                                <p className="font-mono text-xs text-text-secondary">Monospace (font-mono)</p>
                            </div>
                        </section>

                        {/* Spacing & Radius */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Spacing & Radius</h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Border Radius</h4>
                                    <div className="flex gap-3">
                                        <div className="w-12 h-12 bg-bg-elevated border border-border-subtle rounded-sm flex items-center justify-center text-[10px] text-text-muted">sm</div>
                                        <div className="w-12 h-12 bg-bg-elevated border border-border-subtle rounded-md flex items-center justify-center text-[10px] text-text-muted">md</div>
                                        <div className="w-12 h-12 bg-bg-elevated border border-border-subtle rounded-lg flex items-center justify-center text-[10px] text-text-muted">lg</div>
                                        <div className="w-12 h-12 bg-bg-elevated border border-border-subtle rounded-xl flex items-center justify-center text-[10px] text-text-muted">xl</div>
                                        <div className="w-12 h-12 bg-bg-elevated border border-border-subtle rounded-full flex items-center justify-center text-[10px] text-text-muted">full</div>
                                    </div>
                                </div>
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Spacing Scale</h4>
                                    <div className="flex items-end gap-2">
                                        {[1, 2, 3, 4, 6, 8].map((s) => (
                                            <div key={s} className="flex flex-col items-center gap-1">
                                                <div className="bg-emerald-500/30 border border-emerald-500/50" style={{ width: s * 4, height: s * 4 }} />
                                                <span className="text-[10px] text-text-muted">{s}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {/* ========== COMPONENTS TAB ========== */}
                {activeTab === "Components" && (
                    <div className="space-y-12">
                        {/* Buttons */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Buttons</h2>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface space-y-4">
                                <div>
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Variants</h4>
                                    <div className="flex flex-wrap gap-3">
                                        <Button variant="primary">Primary</Button>
                                        <Button variant="secondary">Secondary</Button>
                                        <Button variant="ghost">Ghost</Button>
                                        <Button variant="danger">Danger</Button>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Sizes</h4>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Button size="xs">Extra Small</Button>
                                        <Button size="sm">Small</Button>
                                        <Button size="md">Medium</Button>
                                        <Button size="lg">Large</Button>
                                        <Button size="icon"><Plus className="w-4 h-4" /></Button>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">States</h4>
                                    <div className="flex flex-wrap gap-3">
                                        <Button loading>Loading</Button>
                                        <Button disabled>Disabled</Button>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Badges */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Status Badges</h2>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                <div className="flex flex-wrap gap-3">
                                    {[
                                        { label: "COMPLETED", class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
                                        { label: "RUNNING", class: "bg-zinc-400/10 text-zinc-300 border-zinc-400/20", icon: Play },
                                        { label: "PAUSED", class: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20", icon: Pause },
                                        { label: "FAILED", class: "bg-rose-500/10 text-rose-400 border-rose-500/20", icon: XCircle },
                                        { label: "PENDING", class: "bg-bg-elevated text-text-muted border-border-subtle", icon: Clock },
                                    ].map((b) => (
                                        <span key={b.label} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${b.class}`}>
                                            <b.icon className="w-3 h-3" />{b.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Panels */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Panels</h2>
                            <div className="grid gap-4 md:grid-cols-3">
                                <Panel title="Default Panel"><div className="p-4 text-sm text-text-secondary">Default variant</div></Panel>
                                <Panel title="Elevated" variant="elevated"><div className="p-4 text-sm text-text-secondary">Elevated variant</div></Panel>
                                <Panel title="With Action" headerAction={<Button size="xs">Action</Button>}><div className="p-4 text-sm text-text-secondary">With header action</div></Panel>
                            </div>
                        </section>

                        {/* Modal */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Modal</h2>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                <Button onClick={() => setShowModal(true)}>Open Modal</Button>
                                <Modal open={showModal} onClose={() => setShowModal(false)} title="Modal Title" subtitle="This is a modal subtitle">
                                    <div className="text-sm text-text-secondary">Modal content goes here. Press Escape or click outside to close.</div>
                                </Modal>
                            </div>
                        </section>

                        {/* Forms */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Form Elements</h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface space-y-3">
                                    <label className="block text-xs font-medium text-text-secondary">Text Input</label>
                                    <input type="text" placeholder="Enter text..." className="w-full px-3 py-2 rounded-md border border-border-subtle bg-bg-app text-text-primary text-sm focus:outline-none focus:border-border-strong" />
                                </div>
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface space-y-3">
                                    <label className="block text-xs font-medium text-text-secondary">Select</label>
                                    <select className="w-full px-3 py-2 rounded-md border border-border-subtle bg-bg-app text-text-primary text-sm focus:outline-none focus:border-border-strong">
                                        <option>Option 1</option>
                                        <option>Option 2</option>
                                    </select>
                                </div>
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface space-y-3">
                                    <label className="block text-xs font-medium text-text-secondary">Textarea</label>
                                    <textarea placeholder="Enter text..." rows={3} className="w-full px-3 py-2 rounded-md border border-border-subtle bg-bg-app text-text-primary text-sm resize-none focus:outline-none focus:border-border-strong" />
                                </div>
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface space-y-3">
                                    <label className="block text-xs font-medium text-text-secondary">Checkbox & Radio</label>
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" className="rounded border-border-subtle" /> Checkbox option</label>
                                        <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="radio" name="radio" /> Radio option</label>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Loading */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Loading States</h2>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface space-y-4">
                                <div className="space-y-2">
                                    <Skeleton width="w-3/4" height="h-4" />
                                    <Skeleton width="w-1/2" height="h-4" />
                                    <Skeleton width="w-2/3" height="h-4" />
                                </div>
                                <div className="flex gap-4">
                                    <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
                                    <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                                    <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
                                </div>
                            </div>
                        </section>

                        {/* Icons */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Icons (Lucide)</h2>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                <div className="flex flex-wrap gap-4">
                                    {[Home, Settings, User, Search, Plus, Edit3, Trash2, Copy, Check, X, AlertCircle, CheckCircle2, XCircle, Clock, Folder, File, Terminal, Database, Globe, History, Layers, Share2, Command, MoreHorizontal].map((Icon, i) => (
                                        <div key={i} className="w-10 h-10 flex items-center justify-center rounded-md bg-bg-elevated border border-border-subtle">
                                            <Icon className="w-4 h-4 text-text-secondary" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {/* ========== PATTERNS TAB ========== */}
                {activeTab === "Patterns" && (
                    <div className="space-y-12">
                        {/* Card Pattern */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Card Patterns</h2>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface hover:border-border-strong transition-colors">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                            <Zap className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium text-text-primary">Feature Card</h4>
                                            <p className="text-[10px] text-text-muted">With icon</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-text-secondary">Card description text goes here.</p>
                                </div>
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-medium text-text-primary">Stat Card</h4>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">+12%</span>
                                    </div>
                                    <p className="text-2xl font-bold text-text-primary">1,234</p>
                                    <p className="text-xs text-text-muted">Total items</p>
                                </div>
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500" />
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-medium text-text-primary truncate">User Card</h4>
                                            <p className="text-[10px] text-text-muted">user@example.com</p>
                                        </div>
                                        <Button size="xs" variant="ghost"><MoreHorizontal className="w-4 h-4" /></Button>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* List Patterns */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">List Patterns</h2>
                            <div className="rounded-lg border border-border-subtle bg-bg-surface overflow-hidden">
                                {[
                                    { title: "List Item 1", desc: "Description text", status: "COMPLETED", icon: FileCode },
                                    { title: "List Item 2", desc: "Another description", status: "RUNNING", icon: Terminal },
                                    { title: "List Item 3", desc: "Third item", status: "FAILED", icon: Database },
                                ].map((item, i) => (
                                    <div key={i} className={`flex items-center gap-3 px-4 py-3 hover:bg-state-hover transition-colors ${i > 0 ? 'border-t border-border-subtle' : ''}`}>
                                        <item.icon className="w-4 h-4 text-text-muted" />
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-medium text-text-primary">{item.title}</h4>
                                            <p className="text-[10px] text-text-muted">{item.desc}</p>
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded border ${item.status === 'COMPLETED' ? 'text-emerald-400 border-emerald-500/30' :
                                                item.status === 'RUNNING' ? 'text-zinc-300 border-zinc-500/30' :
                                                    'text-rose-400 border-rose-500/30'
                                            }`}>{item.status}</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Empty State */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Empty States</h2>
                            <div className="p-8 rounded-lg border border-border-subtle bg-bg-surface text-center">
                                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center">
                                    <Folder className="w-6 h-6 text-text-muted" />
                                </div>
                                <h4 className="text-sm font-medium text-text-primary mb-1">No items found</h4>
                                <p className="text-xs text-text-muted mb-4">Get started by creating your first item.</p>
                                <Button><Plus className="w-4 h-4 mr-2" />Create Item</Button>
                            </div>
                        </section>
                    </div>
                )}

                {/* ========== EXTENSION TAB ========== */}
                {activeTab === "Extension" && (
                    <div className="space-y-12">
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">VS Code Extension Panel</h2>
                            <div className="max-w-sm mx-auto rounded-xl border border-zinc-700 overflow-hidden shadow-2xl" style={{ background: '#1e1e1e' }}>
                                <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-zinc-700">
                                    <div className="flex gap-1">
                                        {[{ tab: 'chat' as const, icon: MessageSquare }, { tab: 'runs' as const, icon: List }, { tab: 'settings' as const, icon: Settings }].map(({ tab, icon: Icon }) => (
                                            <button key={tab} onClick={() => setExtensionTab(tab)} className={`w-7 h-7 flex items-center justify-center rounded-md border transition-colors ${extensionTab === tab ? 'border-sky-500/50 bg-zinc-800' : 'border-transparent hover:bg-zinc-800'}`}>
                                                <Icon className="w-4 h-4 text-zinc-300" />
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-1">
                                        <button className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-zinc-800"><RefreshCw className="w-4 h-4 text-zinc-400" /></button>
                                        <button className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-zinc-800"><User className="w-4 h-4 text-zinc-400" /></button>
                                    </div>
                                </div>

                                {extensionTab === 'chat' && (
                                    <div className="flex flex-col h-80">
                                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                            <div className="rounded-lg p-3 border border-zinc-700 bg-zinc-800/50">
                                                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">user</div>
                                                <div className="text-sm text-zinc-200">Analyze the auth flow</div>
                                            </div>
                                            <div className="rounded-lg p-3 border border-zinc-700 bg-zinc-800/50">
                                                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">assistant</div>
                                                <div className="text-sm text-zinc-300">I&apos;ll analyze the authentication flow...</div>
                                            </div>
                                        </div>
                                        <div className="p-2">
                                            <div className="rounded-2xl border border-zinc-700 p-3" style={{ background: '#3c3c3c' }}>
                                                <textarea placeholder="Ask anything..." className="w-full bg-transparent text-sm text-zinc-200 placeholder-zinc-500 resize-none focus:outline-none" rows={1} />
                                                <div className="flex items-center justify-between gap-2 mt-2">
                                                    <div className="flex gap-1">
                                                        <div className="flex items-center gap-1 px-2 h-6 rounded-full border border-zinc-700 bg-zinc-800 text-[11px]">
                                                            <BarChart3 className="w-3 h-3 text-zinc-400" /><span className="text-zinc-300">Agent</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 px-2 h-6 rounded-full border border-zinc-700 bg-zinc-800 text-[11px]">
                                                            <Cpu className="w-3 h-3 text-zinc-400" /><span className="text-zinc-300">gpt-4o</span>
                                                        </div>
                                                    </div>
                                                    <button className="w-7 h-7 flex items-center justify-center rounded-full border border-zinc-700 bg-zinc-800"><ArrowUp className="w-3.5 h-3.5 text-zinc-300" /></button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {extensionTab === 'runs' && (
                                    <div className="h-80 overflow-y-auto p-2 space-y-1">
                                        {[{ title: 'Analyze auth', status: 'completed' }, { title: 'Review code', status: 'running' }, { title: 'Debug issue', status: 'failed' }].map((run, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-800/50 transition-colors">
                                                <div className="text-sm text-zinc-200">{run.title}</div>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase border ${run.status === 'completed' ? 'text-emerald-400 border-emerald-500/40' : run.status === 'running' ? 'text-sky-400 border-sky-500/40' : 'text-rose-400 border-rose-500/40'}`}>{run.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {extensionTab === 'settings' && (
                                    <div className="h-80 p-3 space-y-4">
                                        <div className="space-y-2">
                                            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Workspace</div>
                                            <input defaultValue="/path/to/project" className="w-full px-2 py-1.5 rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs focus:outline-none focus:border-sky-500" />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="text-[10px] uppercase tracking-wider text-zinc-500">LLM Provider</div>
                                            <select className="w-full px-2 py-1.5 rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs focus:outline-none">
                                                <option>Azure OpenAI</option>
                                                <option>LM Studio</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Status Tags */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Extension Status Tags</h2>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                <div className="flex flex-wrap gap-3">
                                    {['completed', 'running', 'failed', 'pending', 'paused'].map((s) => (
                                        <span key={s} className={`text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider border ${s === 'completed' ? 'text-emerald-400 border-emerald-500/40' :
                                                s === 'running' ? 'text-sky-400 border-sky-500/40' :
                                                    s === 'failed' ? 'text-rose-400 border-rose-500/40' :
                                                        s === 'pending' ? 'text-amber-400 border-amber-500/40' :
                                                            'text-zinc-400 border-zinc-500/40'
                                            }`}>{s}</span>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {/* ========== AI PATTERNS TAB ========== */}
                {activeTab === "AI Patterns" && (
                    <div className="space-y-12">
                        {/* Thoughts */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Thoughts (Cursor-Style)</h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Thinking (Active)</h4>
                                    <div className="rounded-md border border-violet-500/40 bg-violet-500/10">
                                        <div className="flex items-center gap-2 px-3 py-2 text-xs text-violet-300">
                                            <Brain className="w-4 h-4 animate-pulse" /><span className="font-medium">Thinking...</span>
                                            <Loader2 className="w-3 h-3 ml-auto animate-spin text-violet-400" />
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Thought (Expandable)</h4>
                                    <div className="rounded-md border border-violet-500/30 bg-violet-500/5 overflow-hidden">
                                        <button onClick={() => setThoughtsExpanded(!thoughtsExpanded)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-violet-300 hover:bg-violet-500/10">
                                            <Brain className="w-4 h-4" /><span className="font-medium">Planning approach</span>
                                            {thoughtsExpanded ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronRight className="w-3 h-3 ml-auto" />}
                                        </button>
                                        {thoughtsExpanded && <div className="px-3 pb-2 text-[11px] text-violet-200/70 border-t border-violet-500/20 pt-2">I need to understand the current implementation before making changes...</div>}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Tools */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Tool Calls (Cursor-Style)</h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Tool Container</h4>
                                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10">
                                        <button onClick={() => setToolsExpanded(!toolsExpanded)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-300 hover:bg-amber-500/20">
                                            <Wrench className="w-4 h-4" /><span className="font-medium">Tools (3)</span>
                                            {toolsExpanded ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronRight className="w-3 h-3 ml-auto" />}
                                        </button>
                                        {toolsExpanded && (
                                            <div className="px-2 pb-2 space-y-1">
                                                <div className="flex items-center gap-2 text-[10px] py-1.5 px-2 rounded bg-zinc-800/50"><Search className="w-3 h-3 text-amber-400" /><span className="text-zinc-300">read_file</span><span className="text-zinc-500">auth.ts</span><CheckCircle2 className="w-3 h-3 text-emerald-400 ml-auto" /></div>
                                                <div className="flex items-center gap-2 text-[10px] py-1.5 px-2 rounded bg-zinc-800/50"><Code2 className="w-3 h-3 text-amber-400" /><span className="text-zinc-300">edit_file</span><span className="text-zinc-500">middleware.ts</span><Loader2 className="w-3 h-3 text-sky-400 ml-auto animate-spin" /></div>
                                                <div className="flex items-center gap-2 text-[10px] py-1.5 px-2 rounded bg-zinc-800/50"><Terminal className="w-3 h-3 text-amber-400" /><span className="text-zinc-300">run_command</span><span className="text-zinc-500">npm test</span><XCircle className="w-3 h-3 text-rose-400 ml-auto" /></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <h4 className="text-xs font-medium text-text-secondary mb-3">Tool Icons</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {[{ name: 'read_file', icon: Search }, { name: 'edit_file', icon: Code2 }, { name: 'list_dir', icon: Folder }, { name: 'run_command', icon: Terminal }, { name: 'grep_search', icon: FileText }, { name: 'git_diff', icon: GitBranch }].map(({ name, icon: Icon }) => (
                                            <div key={name} className="flex items-center gap-1.5 text-[10px] py-1 px-2 rounded bg-zinc-800/50 border border-zinc-700/50">
                                                <Icon className="w-3 h-3 text-amber-400" /><span className="text-zinc-300">{name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Diff Approval */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">Diff Approval (Cursor-Style)</h2>
                            <div className="flex items-center gap-2 p-3 rounded-lg border border-border-subtle bg-bg-surface">
                                <span className="text-xs text-text-secondary mr-2">Bulk:</span>
                                <button onClick={handleApproveAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-medium hover:bg-emerald-500/20"><CheckCheck className="w-3.5 h-3.5" />Approve All</button>
                                <button onClick={handleRejectAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/30 text-xs font-medium hover:bg-rose-500/20"><XOctagon className="w-3.5 h-3.5" />Reject All</button>
                                <button onClick={() => setDiffStates({ 'diff-1': 'pending', 'diff-2': 'pending', 'diff-3': 'pending' })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-500/10 text-zinc-400 border border-zinc-500/30 text-xs font-medium hover:bg-zinc-500/20"><RotateCcw className="w-3.5 h-3.5" />Reset</button>
                            </div>

                            <div className="space-y-3">
                                {[{ id: 'diff-1', file: 'auth.ts', badge: '+12 -3' }, { id: 'diff-2', file: 'jwt.ts', badge: 'NEW' }, { id: 'diff-3', file: '.env', badge: '+1' }].map((d) => (
                                    <div key={d.id} className={`rounded-lg border overflow-hidden transition-colors ${diffStates[d.id] === 'approved' ? 'border-emerald-500/40 bg-emerald-500/5' : diffStates[d.id] === 'rejected' ? 'border-rose-500/40 bg-rose-500/5' : 'border-zinc-700 bg-zinc-900'}`}>
                                        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700/50">
                                            <div className="flex items-center gap-2">
                                                <FileCode className="w-4 h-4 text-zinc-400" />
                                                <span className="text-sm font-medium text-zinc-200">{d.file}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${d.badge === 'NEW' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-400'}`}>{d.badge}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                {diffStates[d.id] === 'pending' ? (
                                                    <>
                                                        <button onClick={() => handleApprove(d.id)} className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-medium hover:bg-emerald-500/20"><Check className="w-3 h-3" />Accept</button>
                                                        <button onClick={() => handleReject(d.id)} className="flex items-center gap-1 px-2 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-medium hover:bg-rose-500/20"><X className="w-3 h-3" />Reject</button>
                                                    </>
                                                ) : (
                                                    <span className={`text-[10px] font-medium uppercase ${diffStates[d.id] === 'approved' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {diffStates[d.id] === 'approved' ? '✓ Approved' : '✕ Rejected'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="p-3 font-mono text-[11px] leading-relaxed">
                                            <div className="text-zinc-500">{"  // existing code..."}</div>
                                            <div className="text-rose-400 bg-rose-500/10 px-1 -mx-1">{"- const old = 'value';"}</div>
                                            <div className="text-emerald-400 bg-emerald-500/10 px-1 -mx-1">{"+ const new = 'updated';"}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                <h4 className="text-xs font-medium text-text-secondary mb-3">Button Variants</h4>
                                <div className="flex flex-wrap gap-3">
                                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-medium"><Check className="w-3.5 h-3.5" />Accept</button>
                                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/30 text-xs font-medium"><X className="w-3.5 h-3.5" />Reject</button>
                                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/30 text-xs font-medium"><Eye className="w-3.5 h-3.5" />Preview</button>
                                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-500/10 text-zinc-400 border border-zinc-500/30 text-xs font-medium"><GitBranch className="w-3.5 h-3.5" />View Diff</button>
                                </div>
                            </div>
                        </section>
                    </div>
                )}
            </main>

            <footer className="border-t border-border-subtle bg-bg-surface mt-16">
                <div className="max-w-7xl mx-auto px-6 py-6 text-center">
                    <p className="text-xs text-text-muted">🧠 Numezis Design System v3.0 • Complete Edition • February 2026</p>
                </div>
            </footer>
        </div>
    );
}
