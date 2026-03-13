import type { Metadata } from "next";
import { Header } from "@/components/Header";
export const metadata: Metadata = {
  title: "Profile",
};

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <div className="px-4 md:px-10">{children}</div>
      </main>
    </div>
  );
}
