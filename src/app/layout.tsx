import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NewsReal.ai \u2014 The Story Behind the Story",
  description:
    "AI-powered media criticism and narrative analysis. Exposing bias on all sides, following the money, and highlighting what the news cycle buries.",
  keywords: [
    "media criticism",
    "AI analysis",
    "news bias",
    "narrative analysis",
    "media literacy",
  ],
  openGraph: {
    title: "NewsReal.ai \u2014 The Story Behind the Story",
    description:
      "AI-powered media criticism and narrative analysis. Question everything, including us.",
    type: "website",
    siteName: "NewsReal.ai",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
