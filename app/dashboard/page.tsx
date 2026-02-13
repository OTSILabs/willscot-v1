import { ProcessVideoModal } from "@/components/process-video-modal";
import { ResultsTable } from "@/components/results-table";

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Manage and process your video analysis results.
          </p>
        </div>
        <ProcessVideoModal />
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Processing Results</h2>
        <ResultsTable />
      </div>
    </div>
  );
}
