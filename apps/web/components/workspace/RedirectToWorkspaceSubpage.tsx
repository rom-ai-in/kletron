"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const PATHS: Record<"skills" | "connectors" | "plugins", string> = {
    skills: "/app/skills",
    connectors: "/app/config/connectors",
    plugins: "/app/plugins",
};

export function RedirectToWorkspaceSubpage({
    segment,
}: {
    segment: "skills" | "connectors" | "plugins";
}) {
    const router = useRouter();

    useEffect(() => {
        router.replace(PATHS[segment]);
    }, [router, segment]);

    return (
        <div className="flex h-full flex-col bg-bg-app">
            <div className="p-6 text-sm text-text-muted">Redirecting…</div>
        </div>
    );
}
