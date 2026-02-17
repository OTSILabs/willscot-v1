import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: {
    default: "Willscot Video Analysier",
    template: "%s | Willscot Video Analysier",
  },
  description: "Willscot video analysis platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await getCurrentUserServerAction();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <CurrentUserProvider initialUser={currentUser}>
            <TooltipProvider>{children}</TooltipProvider>
          </CurrentUserProvider>
        </Providers>
      </body>
    </html>
  );
}
