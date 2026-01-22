import "./globals.css";
import type { ReactNode } from "react";

import { Sidebar } from "@/src/components/Sidebar";

export const metadata = {
  title: "Numezis Coder",
  description: "Agent dashboard with timeline and chat for the MCP stack.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden bg-bg-app">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
