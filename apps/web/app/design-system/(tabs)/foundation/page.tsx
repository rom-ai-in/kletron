"use client";

import {
    surfaces,
    borders,
    text,
    states,
    chain,
    brand,
    agent,
    rawColors,
    glassSurfaces,
    glassBorders,
    glassBlur,
    spacing,
    componentSpacing,
    gaps,
    radius,
    componentRadius,
    fontFamily,
    fontSize,
    fontWeight,
    lineHeight,
    letterSpacing,
    textStyles,
    duration,
    easing,
    transitions,
    shadows,
    glows,
    componentShadows,
    zIndex,
    layerIndex,
} from "@kletron/ui/tokens";

import { DocCard, DocCode, DocRules, DocSection, DocSubSection } from "../../components/DocBlocks";

export default function DesignSystemFoundationPage() {
    return (
        <div className="space-y-12">
            <DocSection
                title="Principles"
                description="Foundations are the non-negotiable rules. Everything else (components, patterns, pages) should read from these tokens and principles."
            >
                <DocRules
                    rules={[
                        "Prefer Tailwind classes that map to tokens (bg-bg-surface, text-text-primary) over inline styles.",
                        "Use semantic tokens first (surfaces, text, states, chain, agent) and raw colors only for fallbacks.",
                        "Spacing uses a 4px base scale. Avoid ad-hoc values unless you are extending the system.",
                        "Use typography tokens for hierarchy. Body is text-sm by default, headings use text-lg and up.",
                        "Motion should be subtle. Use duration.fast for hover and duration.normal for layout changes.",
                    ]}
                />
                <DocCode
                    code={`// Tokens (TS)
import { colors, spacing, typography } from "@kletron/ui/tokens";

// Prefer Tailwind (CSS vars)
<div className="bg-bg-surface text-text-primary border border-border-subtle" />`}
                />
            </DocSection>

            <DocSection
                title="Color System"
                description="Semantic colors for surfaces, text, borders, state overlays, and agent activity."
            >
                <div className="grid gap-6 lg:grid-cols-2">
                    <TokenGroup title="Surfaces" tokens={surfaces} swatch="bg" />
                    <TokenGroup title="Borders" tokens={borders} swatch="border" />
                    <TokenGroup title="Text" tokens={text} swatch="text" />
                    <TokenGroup title="States" tokens={states} swatch="bg" />
                    <TokenGroup title="Chain Status" tokens={chain} swatch="bg" />
                    <TokenGroup title="Brand" tokens={brand} swatch="bg" />
                    <TokenGroup title="Agent" tokens={agent} swatch="bg" />
                    <TokenGroup title="Raw (Fallback)" tokens={rawColors} swatch="bg" />
                </div>
                <DocCode
                    code={`// CSS variables
<div className="bg-bg-app text-text-primary border border-border-subtle" />

// Inline (last resort)
<div style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }} />`}
                />
            </DocSection>

            <DocSection
                title="Glass / Frosted Surfaces"
                description="Semi-transparent surfaces for macOS vibrancy and CSS backdrop-filter. Use .glass-* utility classes or bg-glass-* Tailwind classes."
            >
                <div className="grid gap-6 lg:grid-cols-2">
                    <TokenGroup title="Glass Surfaces" tokens={glassSurfaces} swatch="bg" />
                    <TokenGroup title="Glass Borders" tokens={glassBorders} swatch="border" />
                    <TokenGroup title="Glass Blur" tokens={glassBlur} />
                </div>
                <DocCard title="Glass Utility Classes">
                    <div className="glass-demo-bg rounded-xl p-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="glass-sidebar rounded-lg p-4 h-24 flex items-center justify-center">
                                <span className="text-xs text-text-secondary">.glass-sidebar</span>
                            </div>
                            <div className="glass-titlebar rounded-lg p-4 h-24 flex items-center justify-center">
                                <span className="text-xs text-text-secondary">.glass-titlebar</span>
                            </div>
                            <div className="glass-elevated rounded-lg p-4 h-24 flex items-center justify-center">
                                <span className="text-xs text-text-secondary">.glass-elevated</span>
                            </div>
                            <div className="glass-card rounded-lg p-4 h-24 flex items-center justify-center">
                                <span className="text-xs text-text-secondary">.glass-card</span>
                            </div>
                            <div className="glass-input rounded-lg p-4 h-24 flex items-center justify-center">
                                <span className="text-xs text-text-secondary">.glass-input</span>
                            </div>
                            <div className="glass-selected rounded-lg p-4 h-24 flex items-center justify-center">
                                <span className="text-xs text-text-secondary">.glass-selected</span>
                            </div>
                        </div>
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Use .glass-sidebar for left/right sidebars — most transparent, with xl blur.",
                        "Use .glass-titlebar for title bars and tab bars — slightly more transparent than sidebar.",
                        "Use .glass-elevated for modals, dropdowns, and popovers — stronger border and shadow.",
                        "Use .glass-card for content cards — subtle background with hover transition.",
                        "Use .glass-input for text fields and selectors — minimal background with focus ring.",
                        "Use .glass-selected for active items — brand accent tint.",
                        "On macOS desktop, Electron vibrancy provides the OS-level blur; CSS glass utilities layer on top.",
                        "On web/non-macOS, backdrop-filter provides the blur effect with CSS-only fallback.",
                    ]}
                />
                <DocCode
                    code={`// Glass utility classes
<aside className="glass-sidebar">...</aside>
<header className="glass-titlebar">...</header>
<div className="glass-elevated">Modal content</div>
<div className="glass-card">Card content</div>

// Tailwind color tokens
<div className="bg-glass-sidebar border-glass-border">...</div>

// Electron vibrancy (main.ts)
mainWindow = new BrowserWindow({
  transparent: true,
  backgroundColor: "#00000000",
  vibrancy: "sidebar",
  visualEffectState: "active",
});`}
                />
            </DocSection>

            <DocSection
                title="Typography"
                description="System UI fonts with a monospace stack for code. Use semantic text styles for consistency."
            >
                <div className="grid gap-6 lg:grid-cols-2">
                    <DocCard title="Type Hierarchy">
                        <div className="space-y-2">
                            <p className="text-2xl font-bold text-text-primary">Heading XL</p>
                            <p className="text-xl font-semibold text-text-primary">Heading L</p>
                            <p className="text-lg font-medium text-text-primary">Heading M</p>
                            <p className="text-sm text-text-primary">Body (text-sm)</p>
                            <p className="text-xs text-text-secondary">Small (text-xs)</p>
                            <p className="text-[10px] text-text-muted">Micro (text-[10px])</p>
                            <p className="font-mono text-xs text-text-secondary">Monospace (font-mono)</p>
                        </div>
                    </DocCard>
                    <DocCard title="Text Styles" description="Semantic presets for headings, body, and labels.">
                        <TokenList tokens={textStyles} />
                    </DocCard>
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                    <TokenGroup title="Font Sizes" tokens={fontSize} />
                    <TokenGroup title="Font Weights" tokens={fontWeight} />
                    <TokenGroup title="Line Heights" tokens={lineHeight} />
                    <TokenGroup title="Letter Spacing" tokens={letterSpacing} />
                    <TokenGroup title="Font Families" tokens={fontFamily} />
                </div>
            </DocSection>

            <DocSection
                title="Spacing"
                description="4px scale with semantic component spacing. Use `gaps` for layout and `componentSpacing` for UI primitives."
            >
                <div className="grid gap-6 lg:grid-cols-2">
                    <TokenGroup title="Scale" tokens={spacing} />
                    <TokenGroup title="Gaps" tokens={gaps} />
                </div>
                <DocSubSection title="Component Spacing">
                    <TokenList tokens={componentSpacing} />
                </DocSubSection>
                <DocCode
                    code={`// Example layout spacing
<div className="px-6 py-4 space-y-6">
  <section className="space-y-3">...</section>
</div>`}
                />
            </DocSection>

            <DocSection
                title="Radius"
                description="Rounded corners use semantic sizes. Pills and avatars use full radius."
            >
                <div className="grid gap-6 lg:grid-cols-2">
                    <TokenGroup title="Scale" tokens={radius} />
                    <TokenGroup title="Component Radius" tokens={componentRadius} />
                </div>
                <DocCard title="Radius Preview">
                    <div className="grid grid-cols-3 gap-3">
                        <RadiusSwatch label="sm" value="var(--radius-sm)" />
                        <RadiusSwatch label="md" value="var(--radius-md)" />
                        <RadiusSwatch label="lg" value="var(--radius-lg)" />
                        <RadiusSwatch label="xl" value="var(--radius-xl)" />
                        <RadiusSwatch label="full" value="9999px" />
                    </div>
                </DocCard>
            </DocSection>

            <DocSection
                title="Shadows & Glows"
                description="Elevation is subtle. Use shadows for depth and glows for emphasis on focus or critical states."
            >
                <div className="grid gap-6 lg:grid-cols-2">
                    <TokenGroup title="Shadows" tokens={shadows} />
                    <TokenGroup title="Glows" tokens={glows} />
                    <TokenGroup title="Component Shadows" tokens={componentShadows} />
                </div>
                <DocCard title="Shadow Preview">
                    <div className="grid grid-cols-2 gap-4">
                        {Object.entries(shadows).map(([key, value]) => (
                            <div key={key} className="rounded-md bg-bg-surface border border-border-subtle p-3" style={{ boxShadow: value }}>
                                <div className="text-xs text-text-primary">{key}</div>
                                <div className="text-[10px] text-text-muted">{String(value)}</div>
                            </div>
                        ))}
                    </div>
                </DocCard>
            </DocSection>

            <DocSection
                title="Motion"
                description="Motion is minimal and purposeful. Use standard durations and easing presets."
            >
                <div className="grid gap-6 lg:grid-cols-2">
                    <TokenGroup title="Durations" tokens={duration} />
                    <TokenGroup title="Easing" tokens={easing} />
                    <TokenGroup title="Transitions" tokens={transitions} />
                </div>
                <DocCode
                    code={`// Transition usage
<div className="transition-colors duration-150" />

// Token usage
<div style={{ transition: \`all ${duration.normal} ${easing.default}\` }} />`}
                />
            </DocSection>

            <DocSection
                title="Z-Index & Layers"
                description="Use the z-index scale and semantic layer mapping to avoid stacking conflicts."
            >
                <div className="grid gap-6 lg:grid-cols-2">
                    <TokenGroup title="Z-Index" tokens={zIndex} />
                    <TokenGroup title="Layer Index" tokens={layerIndex} />
                </div>
            </DocSection>
        </div>
    );
}

function TokenGroup({
    title,
    tokens,
    swatch = "chip",
}: {
    title: string;
    tokens: Record<string, string | number | object>;
    swatch?: "bg" | "text" | "border" | "chip";
}) {
    return (
        <DocCard title={title}>
            <div className="space-y-2">
                {Object.entries(tokens).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <TokenSwatch value={value} mode={swatch} />
                            <span className="text-xs font-mono text-text-primary truncate">{key}</span>
                        </div>
                        <span className="text-[10px] text-text-muted truncate">{String(value)}</span>
                    </div>
                ))}
            </div>
        </DocCard>
    );
}

function TokenList({ tokens }: { tokens: Record<string, unknown> }) {
    return (
        <div className="space-y-1">
            {Object.entries(tokens).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                    <span className="text-xs font-mono text-text-primary truncate">{key}</span>
                    <span className="text-[10px] text-text-muted truncate">{JSON.stringify(value)}</span>
                </div>
            ))}
        </div>
    );
}

function TokenSwatch({ value, mode }: { value: string | number | object; mode: "bg" | "text" | "border" | "chip" }) {
    if (mode === "text") {
        return (
            <span className="text-xs font-medium" style={{ color: String(value) }}>
                Aa
            </span>
        );
    }

    if (mode === "border") {
        return (
            <span
                className="w-5 h-5 rounded border"
                style={{ borderColor: String(value), background: "transparent" }}
            />
        );
    }

    if (mode === "bg") {
        return (
            <span className="w-5 h-5 rounded" style={{ background: String(value) }} />
        );
    }

    return (
        <span className="px-2 py-0.5 rounded-md border border-border-subtle text-[10px] text-text-muted">
            token
        </span>
    );
}

function RadiusSwatch({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-bg-elevated border border-border-subtle" style={{ borderRadius: value }} />
            <div>
                <div className="text-xs text-text-primary font-mono">{label}</div>
                <div className="text-[10px] text-text-muted">{value}</div>
            </div>
        </div>
    );
}
