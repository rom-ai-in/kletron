import "./globals.css";
import type { ReactNode } from "react";

import { AuthProvider } from "@/src/context/AuthContext";
import { AppShell } from "@/src/components/AppShell";

export const metadata = {
  title: "PayMe",
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


