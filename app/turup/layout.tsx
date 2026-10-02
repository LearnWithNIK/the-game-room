import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Turup — The Game Room",
  description: "Play four-player Turup with friends and bots in a private room.",
};

export default function TurupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
