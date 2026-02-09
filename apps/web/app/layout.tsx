import "./globals.css";
import type { ReactNode } from "react";

import { AuthProvider } from "@numezis/ui/context/AuthContext";
import { AppShell } from "@numezis/ui/components/AppShell";
import { ThemeProvider, themeScript } from "@numezis/ui/hooks/useTheme";

export const metadata = {
  title: "Numezis Code",
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
          <AuthProvider>
            <AppShell>
              {children}
            </AppShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
