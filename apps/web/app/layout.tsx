import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fraunces",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "InterviewByte — AI Recruitment & Agentic Voice Interview Platform",
    template: "%s · InterviewByte",
  },
  description:
    "AI recruitment & autonomous agentic voice interview platform. Screen candidates, parse resumes, match competencies, and conduct real-time AI voice interviews.",
  applicationName: "InterviewByte",
  openGraph: {
    title: "InterviewByte — AI Recruitment & Agentic Voice Interview Platform",
    description:
      "AI recruitment & autonomous agentic voice interview platform. Screen candidates, parse resumes, and conduct real-time AI voice interviews.",
    url: "/",
    siteName: "InterviewByte",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "InterviewByte — AI Recruitment & Agentic Voice Interview Platform",
    description:
      "AI recruitment & autonomous agentic voice interview platform.",
  },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${jetbrains.variable}`}
    >
      <body className="font-sans">
        <noscript>
          <style
            dangerouslySetInnerHTML={{
              __html: ".reveal{opacity:1!important;transform:none!important}",
            }}
          />
        </noscript>
        {children}
      </body>
    </html>
  );
}
