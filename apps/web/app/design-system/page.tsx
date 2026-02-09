"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TAB_ID_SET, type TabId } from "./config";

const DEFAULT_TAB_ID = "foundation";

function DesignSystemRedirect() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const rawTab = searchParams.get("tab") ?? "";
        const normalized = rawTab.toLowerCase().replace(/\s+/g, "-");
        const target = TAB_ID_SET.has(normalized as TabId) ? normalized : DEFAULT_TAB_ID;
        router.replace(`/design-system/${target}`, { scroll: false });
    }, [router, searchParams]);

    return null;
}

export default function DesignSystemIndexPage() {
    return (
        <Suspense fallback={null}>
            <DesignSystemRedirect />
        </Suspense>
    );
}
