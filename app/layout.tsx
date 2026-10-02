import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Game Room — Turup & Tambola",
  description: "Play Turup and Tambola with friends or bots in private, mobile-friendly rooms.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
