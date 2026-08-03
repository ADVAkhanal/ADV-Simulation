import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "Project Toolpath | Precision Manufacturing Game Prototype";
  const description = "Cut raw stock, manage machine load, inspect the result, and build your manufacturing legacy in this playable browser prototype.";
  return {
    metadataBase: new URL(origin), title, description, applicationName: "Project Toolpath",
    keywords: ["manufacturing game", "machining simulator", "precision manufacturing", "browser game", "machine shop game"],
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { type: "website", url: origin, siteName: "Project Toolpath", title, description, images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "Project Toolpath — turn raw stock into industrial legacy." }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] }, robots: { index: false, follow: false },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body className={`${geist.variable} ${mono.variable}`}>{children}</body></html>; }
