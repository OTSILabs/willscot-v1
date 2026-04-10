import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { getCurrentUserServerAction } from "@/app/actions/current-user";
import { CurrentUserProvider } from "@/components/current-user-provider";
import { Providers } from "@/components/providers";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const interFont = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Willscot Video Analysier",
    template: "%s | Willscot Video Analysier",
  },
  description: "Willscot video analysis platform",
};

import { Toaster } from "@/components/ui/sonner";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await getCurrentUserServerAction();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${interFont.variable} antialiased font-inter md:font-sans pb-20 md:pb-0`}
      >
        <Providers>
          <CurrentUserProvider initialUser={currentUser}>
            <TooltipProvider>{children}</TooltipProvider>
          </CurrentUserProvider>
        </Providers>
        <Toaster key="willscot-root-toaster" richColors closeButton />
      </body>
    </html>
  );
}
