import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

export const metadata: Metadata = {
  title: "Users",
};

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: "power_user" | "normal_user";
}

async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const host = headerStore.get("host");

  const res = await fetch(`http://${host}/api/auth/me`, {
    headers: {
      Cookie: cookieHeader,
    },
  });

  const data = await res.json();
  return data.user ?? null;
}

export default async function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== "normal_user") {
    redirect("/unauthorized");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <div className="px-10">{children}</div>
      </main>
    </div>
  );
}
