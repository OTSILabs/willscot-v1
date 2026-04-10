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
    <div className="xl:hidden flex flex-col divide-y divide-border/40">
      {stats.map((user) => (
        <div key={user.id} className="p-5 bg-white/40 dark:bg-muted/10 space-y-4 hover:bg-muted/5 transition-colors">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-0.5">
              <span className="text-[15px] font-bold text-foreground tracking-tight">{user.name}</span>
              <span className="text-[11px] text-muted-foreground font-medium truncate max-w-[200px]">{user.email}</span>
            </div>
            <Badge 
              variant={(user.accuracy > 80 ? "success" : user.accuracy > 50 ? "warning" : "destructive") as any}
              className="font-extrabold text-[11px] px-2.5 py-0.5 shadow-sm"
            >
              {user.accuracy}%
            </Badge>
          </div>
          
          <div className="space-y-1.5">
            <div className="flex justify-between items-end">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Marking Accuracy</span>
            </div>
            <div className="w-full h-2 bg-muted/50 rounded-full overflow-hidden shadow-inner border border-border/10">
              <div 
                className={cn(
                  "h-full transition-all duration-700 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]",
                  user.accuracy > 80 ? "bg-emerald-500" : user.accuracy > 50 ? "bg-amber-500" : "bg-red-500"
                )}
                style={{ width: `${user.accuracy}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Correct</span>
                <span className="text-sm font-extrabold text-emerald-600">{user.correct}</span>
              </div>
              <div className="flex flex-col border-l border-border/40 pl-4">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Incorrect</span>
                <span className="text-sm font-extrabold text-red-600">{user.incorrect}</span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Total Traces</span>
              <span className="text-sm font-extrabold text-foreground/80">{user.totalTraces}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
