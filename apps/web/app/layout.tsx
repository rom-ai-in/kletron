import "./globals.css";
import type { ReactNode } from "react";

import { AuthProvider } from "@kletron/ui/context/AuthContext";
import { AppShell } from "@kletron/ui/components/AppShell";
import { ThemeProvider, themeScript } from "@kletron/ui/hooks/useTheme";
import { SessionProvider } from "../components/auth/SessionProvider";

export const metadata = {
  title: "Kletron",
  description: "Agent dashboard with timeline and chat for the MCP stack.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-bg-app">
        <ThemeProvider defaultTheme="dark">
          <SessionProvider>
            <AuthProvider>
              <AppShell>
                {children}
              </AppShell>
            </AuthProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
