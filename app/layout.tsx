import "./globals.css";
import type { ReactNode } from "react";

import { Sidebar } from "@/src/components/Sidebar";
import { AppHeader } from "@/src/components/AppHeader";
import { BreadcrumbOverridesProvider } from "@/src/components/ui/BreadcrumbOverridesProvider";

export const metadata = {
  title: "Numezis Coder",
  description: "Agent dashboard with timeline and chat for the MCP stack.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden bg-bg-app">
        <Sidebar />
        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          <BreadcrumbOverridesProvider>
            <AppHeader />
            <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
          </BreadcrumbOverridesProvider>
        </main>
      </body>
    </html>
  );
}
