import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface UserStat {
  id: string;
  name: string;
  email: string;
  accuracy: number;
  correct: number;
  incorrect: number;
  unmarked: number;
  totalTraces: number;
}

interface UserPerformanceTableProps {
  stats: UserStat[];
}

export function UserPerformanceTable({ stats }: UserPerformanceTableProps) {
  return (
    <div className="hidden xl:block overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent bg-muted/5">
            <TableHead className="pl-6 py-4 text-[11px] uppercase tracking-wider font-extrabold text-foreground">User</TableHead>
            <TableHead className="text-center text-[11px] uppercase tracking-wider font-extrabold text-foreground w-[200px]">Marking Progress</TableHead>
            <TableHead className="text-center text-[11px] uppercase tracking-wider font-extrabold text-foreground">Correct</TableHead>
            <TableHead className="text-center text-[11px] uppercase tracking-wider font-extrabold text-foreground">Incorrect</TableHead>
            <TableHead className="text-center text-[11px] uppercase tracking-wider font-extrabold text-foreground">Unmarked</TableHead>
            <TableHead className="text-right pr-6 text-[11px] uppercase tracking-wider font-extrabold text-foreground">Total Traces</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.map((user) => (
            <TableRow key={user.id} className="hover:bg-muted/10 transition-colors group border-b last:border-0">
              <TableCell className="pl-6 py-4">
                <div className="flex flex-col">
                  <span className="font-semibold text-sm text-foreground/90">{user.name}</span>
                  <span className="text-[11px] text-muted-foreground">{user.email}</span>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex flex-col items-center gap-1.5 min-w-[140px]">
                  <div className="flex items-center justify-between w-full px-1">
                    <span className={cn(
                      "text-[10px] font-bold",
                      user.accuracy > 80 ? "text-emerald-600" : user.accuracy > 50 ? "text-amber-600" : "text-red-600"
                    )}>
                      {user.accuracy}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden flex shadow-inner">
                    <div 
                      className={cn(
                        "h-full transition-all duration-500 rounded-full",
                        user.accuracy > 80 ? "bg-emerald-500" : user.accuracy > 50 ? "bg-amber-500" : "bg-red-500"
                      )}
                      style={{ width: `${user.accuracy}%` }}
                    />
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-center font-semibold text-emerald-600">
                {user.correct}
              </TableCell>
              <TableCell className="text-center font-semibold text-red-600">
                {user.incorrect}
              </TableCell>
              <TableCell className="text-center text-muted-foreground font-medium">
                {user.unmarked}
              </TableCell>
              <TableCell className="text-right pr-6 font-semibold text-foreground/70">
                {user.totalTraces}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function UserPerformanceMobile({ stats }: UserPerformanceTableProps) {
  return (
    <div className="xl:hidden flex flex-col divide-y">
      {stats.map((user) => (
        <div key={user.id} className="p-4 bg-white/40 space-y-3">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground/90">{user.name}</span>
              <span className="text-[10px] text-muted-foreground">{user.email}</span>
            </div>
            <Badge 
              variant={(user.accuracy > 80 ? "success" : user.accuracy > 50 ? "warning" : "destructive") as any}
              className="font-bold"
            >
              {user.accuracy}%
            </Badge>
          </div>
          
          <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-500",
                user.accuracy > 80 ? "bg-emerald-500" : user.accuracy > 50 ? "bg-amber-500" : "bg-red-500"
              )}
              style={{ width: `${user.accuracy}%` }}
            />
          </div>

          <div className="flex items-center gap-4 pt-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-600 text-xs text-[10px]">
              {user.correct} Correct
            </div>
            <div className="flex items-center gap-1.5 font-bold text-red-600 text-xs text-[10px]">
              {user.incorrect} Incorrect
            </div>
            <div className="flex items-center gap-1.5 font-bold text-muted-foreground text-xs text-[10px] ml-auto">
              {user.totalTraces} Traces
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
