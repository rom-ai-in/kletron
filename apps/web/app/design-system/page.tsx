"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TAB_ID_SET, type TabId } from "./config";

const DEFAULT_TAB_ID = "foundation";

export default function DesignSystemIndexPage() {
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
