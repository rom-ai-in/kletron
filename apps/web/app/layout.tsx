import "./globals.css";
import type { ReactNode } from "react";

import { AuthProvider } from "@kletron/ui/context/AuthContext";
import { AppShell } from "@kletron/ui/components/AppShell";
import { ThemeProvider, themeScript } from "@kletron/ui/hooks/useTheme";
import { SessionProvider } from "../components/auth/SessionProvider";

export const metadata = {
  title: "Kletron — Sovereign agent platform",
  description:
    "Code and work in one place: visual agent graphs, custom MCPs, local or API models, automations, and EU-sovereign deployment.",
  openGraph: {
    title: "Kletron — Sovereign agent platform",
    description:
      "Visual agent graphs, MCP extensibility, Code + Work modes, automations. Built in Switzerland for Europe.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kletron — Sovereign agent platform",
    description:
      "Visual agent graphs, MCP extensibility, Code + Work modes, automations. Built in Switzerland for Europe.",
  },
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
