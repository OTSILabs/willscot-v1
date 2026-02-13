import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trace Details",
};

export default function TraceDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

