import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Numezis Coder",
  description: "Agent dashboard with timeline and chat for the MCP stack.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
