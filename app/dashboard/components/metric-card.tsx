import { 
  Card, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface MetricCardProps {
  title: string;
  value?: number;
  subtitle?: string;
  icon: React.ReactNode;
  loading?: boolean;
}

export function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon,
  loading = false
}: MetricCardProps) {
  return (
    <Card className="shadow-sm border-border bg-card hover:shadow-md transition-all duration-300 hover:-translate-y-1">
      <CardHeader className="pb-6">
        <div className="flex justify-between items-start">
          <div className="p-2.5 rounded-xl bg-muted/60 shadow-inner border border-border/40 font-bold">{icon}</div>
          <div className="text-4xl font-extrabold tracking-tighter text-foreground">
            {loading ? <Skeleton className="h-10 w-20" /> : `${value}%`}
          </div>
        </div>
        <CardTitle className="text-lg mt-5 capitalize font-bold leading-none">{title}</CardTitle>
        <CardDescription className="text-xs text-muted-foreground font-medium mt-1.5 whitespace-nowrap">
          {loading ? <Skeleton className="h-4 w-24" /> : subtitle}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
