import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kletron CoWork",
  description: "AI-Powered Workspace for Coding, Drafting, and Automation"
};

export default function WorkbenchLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
