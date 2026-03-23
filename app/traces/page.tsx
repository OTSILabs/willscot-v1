"use client";
import { ResultsTable } from "@/components/results-table";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { PageTitle, PageDescription } from "@/components/typography";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";

const RESULTS_POLLING_MS = 10000;

export default function TracesPage() {
  const router = useRouter();
  return (
    <div className="container mx-auto px-0 md:px-0 py-4 md:py-10 space-y-6 md:space-y-8 pb-16 md:pb-10 relative">
      <div className="flex items-start justify-between gap-3 px-0 md:px-0">
        <div className="max-w-[calc(100%-100px)] md:max-w-none space-y-1">
          <PageTitle title="Recent Traces" />
          <PageDescription description="View recent traces" />
        </div>
        <Button 
          onClick={() => router.push("/traces/new")}
          className="md:relative absolute top-4 right-4 md:top-0 md:right-0"
        >
          New Video
        </Button>
      </div>
      <Suspense fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }>
        <ResultsTable pollingMs={RESULTS_POLLING_MS} />
      </Suspense>
    </div>
  );
}
