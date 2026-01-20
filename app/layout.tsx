import "./globals.css";

import type { ReactNode } from "react";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata = {
  title: "Numezis LangGraph Studio",
  description: "Agent dashboard with timeline + chat for the LangGraph MCP stack.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>{children}</body>
    </html>
  );
}
