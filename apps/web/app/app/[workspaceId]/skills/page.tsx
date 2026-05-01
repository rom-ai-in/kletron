"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { Card, CardContent } from "@kletron/ui/components/ui/Card";
import { Button } from "@kletron/ui/components/ui/Button";
import { Switch } from "@kletron/ui/components/ui/Toggle";
import { Input } from "@kletron/ui/components/ui/Input";
import { Search } from "lucide-react";
import { useWorkspaceSkills } from "../../../../hooks/useWorkspaceSkills";

export default function WorkspaceSkillsPage({
    params,
}: {
    params: Promise<{ workspaceId: string }>;
}) {
    const { workspaceId } = use(params);
    const { skills, isLoading, error, setEnabled } = useWorkspaceSkills(workspaceId);
    const [search, setSearch] = useState("");
    const [busy, setBusy] = useState<string | null>(null);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return skills;
        return skills.filter(
            (s) =>
                s.slug.includes(q) ||
                s.name.toLowerCase().includes(q) ||
                s.description.toLowerCase().includes(q) ||
                s.tags.some((tag) => tag.toLowerCase().includes(q))
        );
    }, [skills, search]);

    const groupedByTag = useMemo(() => {
        const map = new Map<string, typeof filtered>();
        for (const skill of filtered) {
            const tags = skill.tags.length > 0 ? skill.tags : ["other"];
            for (const tag of tags) {
                const arr = map.get(tag) ?? [];
                arr.push(skill);
                map.set(tag, arr);
            }
        }
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [filtered]);

    const onToggle = async (slug: string, next: boolean) => {
        setBusy(slug);
        try {
            await setEnabled(slug, next);
        } catch (err) {
            alert((err as Error).message);
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-text-primary">Workspace Skills</h1>
                    <p className="text-text-muted mt-1">
                        Toggle which skills the agent uses for this workspace. Authoring happens
                        in the{" "}
                        <Link href="/app/config/skills" className="underline">
                            global library
                        </Link>
                        .
                    </p>
                </div>
                <Link
                    href={`/app/${workspaceId}/connectors`}
                    className="text-sm text-text-secondary underline"
                >
                    Connectors
                </Link>
            </div>

            <div className="mb-4">
                <Input
                    leftIcon={Search}
                    placeholder="Search skills"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    fullWidth
                />
            </div>

            {error && (
                <p className="mb-4 text-sm text-status-error-text">Error: {error}</p>
            )}
            {isLoading ? (
                <p className="text-text-muted">Loading skills...</p>
            ) : (
                <div className="space-y-6">
                    {groupedByTag.length === 0 ? (
                        <p className="text-sm text-text-muted italic">No skills available.</p>
                    ) : (
                        groupedByTag.map(([tag, group]) => (
                            <section key={tag}>
                                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                    {tag}
                                </h2>
                                <div className="space-y-2">
                                    {group.map((skill) => (
                                        <Card
                                            key={skill.slug}
                                            className="border-border-subtle bg-bg-surface"
                                        >
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-text-primary">
                                                                {skill.name}
                                                            </span>
                                                            <span className="rounded bg-bg-elevated px-2 py-0.5 font-mono text-[10px] text-text-muted">
                                                                {skill.slug}
                                                            </span>
                                                            <span className="rounded bg-bg-elevated px-2 py-0.5 text-[10px] text-text-muted">
                                                                {skill.source}
                                                            </span>
                                                        </div>
                                                        {skill.description && (
                                                            <p className="mt-1 text-xs text-text-muted">
                                                                {skill.description}
                                                            </p>
                                                        )}
                                                        {(skill.requiredTools.length > 0 ||
                                                            skill.suggestedTools.length > 0) && (
                                                            <p className="mt-1 text-[11px] text-text-muted">
                                                                Tools:{" "}
                                                                {[
                                                                    ...skill.requiredTools.map(
                                                                        (t) => `${t}*`
                                                                    ),
                                                                    ...skill.suggestedTools,
                                                                ].join(", ") || "none"}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <Switch
                                                        checked={skill.enabled}
                                                        disabled={busy === skill.slug}
                                                        onChange={(next) =>
                                                            onToggle(skill.slug, next)
                                                        }
                                                    />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </section>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
