import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Playground",
  description: "Invite-only chat platform for sharing AI agents with testers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
