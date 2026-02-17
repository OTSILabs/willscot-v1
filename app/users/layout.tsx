import type { Metadata } from "next";
import { AccessGuard } from "@/components/access-guard";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Users",
};

export default async function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <div className="px-10">
          <AccessGuard allowed={["power_user"]}>{children}</AccessGuard>
        </div>
      </main>
    </div>
  );
}

