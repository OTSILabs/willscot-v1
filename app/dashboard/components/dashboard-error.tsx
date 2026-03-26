import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardErrorProps {
  onRetry: () => void;
}

export function DashboardError({ onRetry }: DashboardErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
      <div className="p-6 rounded-full bg-red-50 text-red-600 border border-red-100">
        <HelpCircle className="w-12 h-12" />
      </div>
      <h2 className="text-2xl font-bold">Unable to sync metrics</h2>
      <p className="text-muted-foreground max-w-md text-center">
        The real-time data connection encountered an issue. Please verify your connection or try a manual refresh.
      </p>
      <Button onClick={onRetry} variant="default" className="mt-4 px-8">
        Try Again
      </Button>
    </div>
  );
}
