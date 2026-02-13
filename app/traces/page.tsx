import { ResultsTable } from "@/components/results-table";
import { ProcessVideoModal } from "@/components/process-video-modal";

export default function TracesPage() {
  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Recent Traces</h1>
          <p className="text-muted-foreground">
            View recent traces processed by the system.
          </p>
        </div>
        <ProcessVideoModal />
      </div>
      <ResultsTable />
    </div>
  );
}
