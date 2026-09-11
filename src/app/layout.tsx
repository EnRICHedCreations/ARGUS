import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "ARGUS", description: "Autonomous Reasoning Graph for Unified Signals" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
