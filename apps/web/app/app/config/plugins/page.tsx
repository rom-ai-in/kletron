import Link from "next/link";
import { Card, CardContent } from "@kletron/ui/components/ui/Card";
import { ArrowRight } from "lucide-react";
import { listPlugins } from "@kletron/shared";

export default function ConfigPluginsPage() {
    const plugins = listPlugins();

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-text-primary">Plugins</h1>
                <p className="text-text-muted mt-1">
                    Curated bundles of skills and connectors (Cowork-style). Install per workspace
                    from the workspace Plugins page; browse connectors for each bundle below.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {plugins.map((p) => (
                    <Link key={p.id} href={`/app/config/plugins/${p.id}`} className="group">
                        <Card className="h-full border-border-subtle bg-bg-surface transition-colors group-hover:border-border-strong">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <h2 className="text-sm font-semibold text-text-primary">{p.name}</h2>
                                        <p className="text-[11px] text-text-muted">{p.publisher}</p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 shrink-0 text-text-muted group-hover:text-text-primary" />
                                </div>
                                <p className="mt-2 line-clamp-3 text-xs text-text-secondary">{p.description}</p>
                                <div className="mt-3 flex gap-3 text-[11px] text-text-muted">
                                    <span>{p.skillSlugs.length} skills</span>
                                    <span>{p.connectorIds.length} connectors</span>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
