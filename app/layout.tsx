import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });
export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("host") ?? "advcosinc.com";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    title: "Advanced | Precision Manufacturing",
    description: "Precision machining, engineered plastics, and connected manufacturing operations built for demanding work.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title: "Advanced | Precision Manufacturing", description: "We make what matters.", images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "Advanced - We make what matters." }] },
    twitter: { card: "summary_large_image", title: "Advanced | Precision Manufacturing", description: "We make what matters.", images: [`${origin}/og.png`] },
  };
}
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body className={`${geist.variable} ${mono.variable}`}>{children}</body></html>; }