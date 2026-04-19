import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "STHLM Triathlon 2026 — Funktionärsapp",
  description: "Hantering av funktionärer för STHLM Triathlon 9 augusti 2026",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
