import type { Metadata } from "next";

/** Legacy deep links `/app/:workspaceId/...` share this shell metadata. */
export const metadata: Metadata = {
    title: "Workspace",
    description: "Open workspace-scoped pages in Kletron",
};

export default function LegacyWorkspaceLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return <>{children}</>;
}
