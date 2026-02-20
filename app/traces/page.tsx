"use client";
import { ResultsTable } from "@/components/results-table";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

const RESULTS_POLLING_MS = 10000;

export default function TracesPage() {
  const router = useRouter();
  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Recent Traces</h1>
          <p className="text-muted-foreground">
            View recent traces processed by the system.
          </p>
        </div>
        <Button onClick={() => router.push("/traces/new")}>New Video</Button>
      </div>
      <ResultsTable pollingMs={RESULTS_POLLING_MS} />
    </div>
  );
}
