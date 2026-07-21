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
  const title = "Advanced | Precision Machining & Manufacturing";
  const description = "Complex precision machining, engineered plastics, fabrication and documented quality systems for aerospace, defense, energy, food processing and industrial programs.";
  return {
    metadataBase: new URL(origin),
    title,
    description,
    applicationName: "Advanced",
    keywords: ["precision machining", "5-axis machining", "AS9100", "ISO 9001", "engineered plastics", "aerospace manufacturing", "Owasso Oklahoma"],
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { type: "website", url: origin, siteName: "Advanced", title, description, images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "Advanced — Built for the parts that cannot fail." }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] },
    robots: { index: true, follow: true },
  };
}
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geist.variable} ${mono.variable}`}>{children}</body></html>;
}