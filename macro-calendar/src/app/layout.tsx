import type { Metadata } from "next";
import { headers } from "next/headers";
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

/**
 * Routes that should skip auth checks in the layout.
 * These routes use alternative authentication mechanisms (e.g., signed tokens)
 * and calling getCurrentUser() could potentially interfere with the user's
 * existing session due to cookie manipulation during token refresh.
 */
const SKIP_AUTH_ROUTES = ["/unsubscribe"];

/**
 * Check if a route should skip auth.
 */
function shouldSkipAuth(pathname: string): boolean {
  return SKIP_AUTH_ROUTES.some((route) => pathname.startsWith(route));
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get the current pathname from headers
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  
  // Skip auth for routes that don't need it to avoid cookie manipulation
  // The unsubscribe page uses a signed token for authorization and
  // a service role Supabase client, so no user authentication is needed
  const user = shouldSkipAuth(pathname) ? null : await getCurrentUser();
  
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
