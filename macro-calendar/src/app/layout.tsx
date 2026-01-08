import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "./components/Header";
import { getCurrentUser } from "@/lib/supabase/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Macro Calendar",
    template: "%s | Macro Calendar",
  },
  description: "Public macroeconomic release calendar with searchable historical data",
  openGraph: {
    title: "Macro Calendar",
    description: "Public macroeconomic release calendar with searchable historical data",
    type: "website",
    siteName: "Macro Calendar",
  },
  twitter: {
    card: "summary",
    title: "Macro Calendar",
    description: "Public macroeconomic release calendar with searchable historical data",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Header initialUser={user} />
        {children}
      </body>
    </html>
  );
}
