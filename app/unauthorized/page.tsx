import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unauthorized",
};

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-bold">Access Denied</h1>
      <p className="text-muted-foreground">
        You don&apos;t have permission to view this page.
      </p>
      <Link
        href="/traces"
        className="text-sm underline underline-offset-4 hover:no-underline"
      >
        Go back to Traces
      </Link>
    </div>
  );
}
