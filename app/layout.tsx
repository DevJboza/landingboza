import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.boza.lat"),
  title: { default: "Johan Boza | Web, Automatización e IA", template: "%s | Johan Boza" },
  description: "Desarrollo sitios web, automatizaciones y asistentes con IA para negocios en Costa Rica.",
  keywords: ["desarrollo web Costa Rica", "automatización n8n", "inteligencia artificial para negocios", "San Vito Puntarenas"],
  authors: [{ name: "Johan Boza", url: "https://www.boza.lat" }],
  creator: "Johan Boza",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website", locale: "es_CR", url: "/", siteName: "Johan Boza",
    title: "Webs que consiguen clientes. Sistemas que trabajan por ti.",
    description: "Desarrollo web, automatización e IA para negocios en Costa Rica.",
  },
  twitter: {
    card: "summary", title: "Johan Boza | Web, Automatización e IA",
    description: "Webs que consiguen clientes. Sistemas que trabajan por ti.",
  },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
