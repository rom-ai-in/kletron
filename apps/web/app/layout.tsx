import "./globals.css";
import type { ReactNode } from "react";

import { AuthProvider } from "@numezis/ui/context/AuthContext";
import { AppShell } from "@numezis/ui/components/AppShell";

export const metadata = {
  title: "Numezis Code",
  description: "Agent dashboard with timeline and chat for the MCP stack.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg-app">
        <AuthProvider>
          <AppShell>
            {children}
          </AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}

