import type { Metadata } from "next";
import Analytics from "@/components/Analytics";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://newsreal.ai";

export const metadata: Metadata = {
  title: "NewsReal.ai \u2014 All the News That's Fit to Shit",
  description:
    "AI-powered media criticism and narrative analysis. Exposing bias on all sides, following the money, and highlighting what the news cycle buries. Trust no single source \u2014 including us.",
  keywords: [
    "media criticism",
    "AI analysis",
    "news bias",
    "narrative analysis",
    "media literacy",
  ],
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: "NewsReal.ai \u2014 All the News That's Fit to Shit",
    description:
      "AI-powered media criticism and narrative analysis. Exposing bias on all sides, following the money, and highlighting what the news cycle buries.",
    type: "website",
    siteName: "NewsReal.ai",
    url: SITE_URL,
    images: [
      {
        url: `${SITE_URL}/api/og`,
        width: 1200,
        height: 630,
        alt: "NewsReal.ai \u2014 All the News That's Fit to Shit",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NewsReal.ai \u2014 All the News That's Fit to Shit",
    description:
      "AI-powered media criticism and narrative analysis. Exposing bias on all sides, following the money, and highlighting what the news cycle buries.",
    images: [`${SITE_URL}/api/og`],
  },
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Analytics />
        {children}
        {modal}
      </body>
    </html>
  );
}
