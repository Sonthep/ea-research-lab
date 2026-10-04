import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import "./globals.css";
export const metadata: Metadata = { title: "EA Research Lab", description: "Reproducible MetaTrader 5 optimization research" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><Shell>{children}</Shell></body></html>; }
