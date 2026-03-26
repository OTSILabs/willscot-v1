import { Skeleton } from "@/components/ui/skeleton";

export function DashboardLoading() {
  return (
    <div className="mx-auto py-10 space-y-8 animate-pulse text-center">
      <Skeleton className="h-10 w-64 mx-auto" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[600px] w-full rounded-xl" />
    </div>
  );
}
