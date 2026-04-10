"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LabelList
} from "recharts";
import { cn } from "@/lib/utils";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  BarChart3, 
  TableProperties,
  HelpCircle, 
  TrendingUp, 
  RotateCcw,
  ShieldCheck,
  Zap,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Suspense } from "react";
import { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { format } from "date-fns";
import { keepPreviousData } from "@tanstack/react-query";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { PageTitle, PageDescription } from "@/components/typography";
import { BackButton } from "@/components/back-button";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useCurrentUser } from "@/components/current-user-provider";
import { getAttributeOrder } from "@/lib/constants";

// Dashboard Components
import { MetricCard } from "./components/metric-card";
import { MultiSelectUserFilter } from "./components/multi-select-user-filter";
import { DashboardLoading } from "./components/dashboard-loading";
import { DashboardError } from "./components/dashboard-error";
import { UserPerformanceTable, UserPerformanceMobile } from "./components/user-performance-table";

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

interface DashboardStats {
  overview: {
    overall: {
      accuracy: number;
      correct: number;
      incorrect: number;
      unmarked: number;
      total: number;
    };
    interior: {
      accuracy: number;
      correct: number;
      incorrect: number;
      unmarked: number;
    };
    exterior: {
      accuracy: number;
      correct: number;
      incorrect: number;
      unmarked: number;
    };
  };
  attributes: Array<{
    name: string;
    accuracy: number;
    correct: number;
    incorrect: number;
    unmarked: number;
    totalTraces: number;
  }>;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const { currentUser } = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize state from URL params
  const [userIds, setUserIds] = useState<string[]>(() => {
    const ids = searchParams.getAll("userId");
    return ids.filter(id => id !== "all" && id !== "");
  });
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = searchParams.get("startDate");
    const to = searchParams.get("endDate");
    if (from && to) {
      return { from: new Date(from), to: new Date(to) };
    } else if (from) {
      return { from: new Date(from) };
    }
    return undefined;
  });

  const startDate = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "";
  const endDate = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : "";

  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(() => {
    const sort = searchParams.get("sortOrder");
    if (sort === "asc" || sort === "desc") return sort;
    return null;
  });

  // Helper to update URL search params
  const updateQueryParams = useCallback((updates: Record<string, string | string[] | null>) => {
    const current = new URLSearchParams(searchParams.toString());
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "all" || value === "" || (Array.isArray(value) && value.length === 0)) {
        current.delete(key);
      } else if (Array.isArray(value)) {
        current.delete(key);
        value.forEach(id => current.append(key, id));
      } else {
        current.set(key, value);
      }
    });

    const search = current.toString();
    if (search !== searchParams.toString()) {
      const query = search ? `?${search}` : "";
      router.replace(`/dashboard${query}`, { scroll: false });
    }
  }, [router, searchParams]);

  // Sync state changes back to URL
  useEffect(() => {
    updateQueryParams({
      userId: userIds,
      startDate,
      endDate,
      sortOrder,
    });
  }, [userIds, startDate, endDate, sortOrder, updateQueryParams]);

  useEffect(() => {
    if (!currentUser) {
      router.push("/login");
    }
  }, [currentUser, router]);

  // Defensive: Always clear multi-user filters for non-power users to prevent stale state
  useEffect(() => {
    if (currentUser && currentUser.role !== "power_user" && userIds.length > 0) {
      setUserIds([]);
    }
  }, [currentUser, userIds]);

  const { data: usersData } = useQuery({
    queryKey: ["users-list", currentUser?.id],
    queryFn: async () => {
      const resp = await axios.get("/api/users?pageSize=100");
      return resp.data.items as Array<{ id: string, name: string }>;
    },
    enabled: !!currentUser && currentUser.role === "power_user",
  });

  const timezone = typeof window !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  const { data, isLoading, isError, refetch, isFetching } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats", currentUser?.id, userIds, startDate, endDate, timezone],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userIds.length > 0) {
        userIds.forEach(id => params.append("userId", id));
      }
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("timezone", timezone);
      
      const resp = await axios.get(`/api/stats/dashboard?${params.toString()}`);
      return resp.data;
    },
    refetchInterval: 5000, 
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0,
    enabled: !!currentUser,
    placeholderData: keepPreviousData,
  });

  const { data: usersStats, isLoading: isUsersStatsLoading } = useQuery<UserStat[]>({
    queryKey: ["user-stats", currentUser?.id, startDate, endDate, timezone],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("timezone", timezone);
      const resp = await axios.get(`/api/stats/users?${params.toString()}`);
      return resp.data;
    },
    enabled: !!currentUser && currentUser.role === "power_user",
    placeholderData: keepPreviousData,
  });

  const sortedAttributes = useMemo(() => {
    const attrs = data?.attributes || [];
    if (!sortOrder) {
      // Use master attribute order by default
      return [...attrs].sort((a, b) => getAttributeOrder(a.name) - getAttributeOrder(b.name));
    }
    return [...attrs].sort((a, b) => {
      if (sortOrder === "asc") return a.accuracy - b.accuracy;
      return b.accuracy - a.accuracy;
    });
  }, [data?.attributes, sortOrder]);

  const toggleSort = useCallback(() => {
    if (!sortOrder) setSortOrder("desc");
    else if (sortOrder === "desc") setSortOrder("asc");
    else setSortOrder(null);
  }, [sortOrder]);

  if (!currentUser) return <DashboardLoading />;
  
  if (isError) return <DashboardError onRetry={() => refetch()} />;

  const overview = data?.overview;
  const attributes = data?.attributes || [];

  return (
   <div className="container mx-auto px-4 xl:px-0 py-4 xl:py-10 space-y-6 xl:space-y-8 pb-16 xl:pb-10 animate-in fade-in duration-700 relative">      {/* Back Button and Header */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <BackButton label="Back to Traces" className="xl:-ml-4" />
          {isFetching && (
            <div className="xl:hidden flex items-center gap-2 text-[10px] font-medium text-muted-foreground animate-pulse mt-1">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Refreshing...
            </div>
          )}
        </div>

        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 xl:gap-0">
          <div className="space-y-1">
            <PageTitle title={currentUser.role === "power_user" ? "Accuracy Dashboard" : "My Accuracy Performance"} />
            <PageDescription 
              description={currentUser.role === "power_user" 
                ? "Performance metrics and extraction precision across all processed traces." 
                : "Your personal extraction precision and performance metrics tracker."
              } 
            />
          </div>
          
          <div className="flex items-center gap-3 self-end md:self-auto">
            {isFetching && (
              <div className="hidden xl:flex items-center gap-2 text-[10px] font-medium text-muted-foreground animate-pulse mr-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Refreshing...
              </div>
            )}
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-emerald-500/5 text-emerald-600 border-emerald-200 animate-pulse px-3 py-1 hidden sm:flex">
                <span className="relative flex h-2 w-2 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live Updates
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetch()} 
                className="w-fit shadow-sm h-9 xl:h-8"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* Filter Bar */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-end gap-3 mb-6 mt-4 p-4 xl:p-0 bg-muted/30 xl:bg-transparent rounded-xl border border-dashed xl:border-none">
        <div className="flex flex-col xl:flex-row items-start xl:items-center gap-2 bg-white/80 xl:bg-white/50 border border-dashed xl:border rounded-lg p-1.5 shadow-sm w-full xl:w-auto">
            {currentUser.role === "power_user" ? (
              <div className="flex items-center gap-2 px-0 xl:px-2 xl:border-r border-border/50 w-full xl:w-auto">
                <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground ml-2 xl:ml-0" />
                <MultiSelectUserFilter 
                  users={usersData || []} 
                  selectedIds={userIds} 
                  onSelectionChange={setUserIds} 
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 px-0 xl:px-3 xl:border-r border-border/50 w-full xl:w-auto py-2 xl:py-0">
                <Zap className="w-3.5 h-3.5 text-blue-500 ml-2 xl:ml-0" />
                <span className="text-xs font-semibold text-foreground/80 px-2">Personal Stats</span>
              </div>
            )}
          <div className="flex items-center gap-2 px-0 xl:px-2 w-full xl:w-auto xl:border-l border-border/50">
            <div className="flex items-center gap-1 flex-1">
              <DatePickerWithRange date={dateRange} setDate={setDateRange} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 shrink-0 w-full xl:w-auto mt-2 xl:mt-0">
          {(userIds.length > 0 || startDate || endDate) && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setUserIds([]);
                setDateRange(undefined);
              }}
              className="h-9 xl:h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Metric Cards - Summary Tier */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <MetricCard 
          title="Overall Accuracy" 
          value={overview?.overall.accuracy} 
          subtitle={`${overview?.overall.correct} approved`}
          icon={<Zap className="w-5 h-5 text-yellow-500" />}
          loading={isLoading}
        />
        <MetricCard 
          title="Interior " 
          value={overview?.interior.accuracy} 
          subtitle="Internal Attributes"
          icon={<ShieldCheck className="w-5 h-5 text-blue-500" />}
          loading={isLoading}
        />
        <MetricCard 
          title="Exterior " 
          value={overview?.exterior.accuracy} 
          subtitle="External Attributes"
          icon={<ShieldCheck className="w-5 h-5 text-emerald-500" />}
          loading={isLoading}
        />
      </div>

      {/* View Toggle Section */}
      <Tabs defaultValue="table" className="w-full">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4">
          <TabsList className={cn(
            "grid w-full xl:w-auto",
            currentUser.role === "power_user" ? "grid-cols-3 xl:min-w-[450px]" : "grid-cols-2 xl:min-w-[300px]"
          )}>
            <TabsTrigger value="table">
              <TableProperties className="w-4 h-4 mr-2" />
              Accuracy 
            </TabsTrigger>
            {currentUser.role === "power_user" && (
              <TabsTrigger value="users">
                <ShieldCheck className="w-4 h-4 mr-2" />
                User Performance
              </TabsTrigger>
            )}
            <TabsTrigger value="chart">
              <BarChart3 className="w-4 h-4 mr-2" />
              Chart View
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center justify-center xl:block text-[11px] xl:text-xs text-muted-foreground font-medium bg-muted/50 px-3 py-2 xl:py-1.5 rounded-full xl:rounded-lg">
            {attributes.length} Monitoring Categories
          </div>
        </div>

        <TabsContent value="table" className="animate-in slide-in-from-right-2 duration-300">
          <Card className="shadow-sm border-border bg-card overflow-hidden">
            <CardHeader className="border-b bg-muted/10 pb-4">
              <CardTitle className="text-lg font-semibold">Accuracy Breakdown</CardTitle>
              <CardDescription>Proportion of correct predictions out of all verified traces (excluding unmarked)</CardDescription>
            </CardHeader>
            {isLoading && !data ? (
              <div className="p-8">
                <DashboardLoading />
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
            <div className="hidden xl:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/5">
                    <TableHead className="pl-6 py-4 text-[11px] uppercase tracking-wider font-extrabold text-foreground">Category Name</TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={toggleSort}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-all group",
                            sortOrder && "bg-muted/50"
                          )}
                        >
                          <span className="text-[11px] uppercase tracking-wider font-extrabold text-foreground">Accuracy</span>
                          <div className="flex flex-col -space-y-1 opacity-40 group-hover:opacity-100 transition-opacity">
                            <ChevronUp className={cn(
                              "h-3 w-3 text-foreground",
                              sortOrder === "asc" && "opacity-100"
                            )} />
                            <ChevronDown className={cn(
                              "h-3 w-3 text-foreground",
                              sortOrder === "desc" && "opacity-100"
                            )} />
                          </div>
                        </button>
                        {sortOrder && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 rounded-full hover:bg-muted/10 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSortOrder(null);
                            }}
                          >
                            <RotateCcw className="w-3 h-3 text-foreground" />
                          </Button>
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="text-center text-[11px] uppercase tracking-wider font-extrabold text-foreground">Correct</TableHead>
                    <TableHead className="text-center text-[11px] uppercase tracking-wider font-extrabold text-foreground">Incorrect</TableHead>
                    <TableHead className="text-center text-[11px] uppercase tracking-wider font-extrabold text-foreground">Unmarked</TableHead>
                    <TableHead className="text-right pr-6 text-[11px] uppercase tracking-wider font-extrabold text-foreground">Total Traces</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAttributes.map((attr: DashboardStats["attributes"][0], idx: number) => (
                    <TableRow key={`attr-row-${attr.name}-${idx}`} className="hover:bg-muted/10 transition-colors group border-b last:border-0">
                      <TableCell className="pl-6 py-4 font-medium text-sm text-foreground/90">
                        {attr.name}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={(attr.accuracy > 80 ? "success" : attr.accuracy > 50 ? "warning" : "destructive") as "default" | "secondary" | "destructive" | "outline" | "success" | "warning"}
                          className="font-bold min-w-[50px] justify-center shadow-sm"
                        >
                          {attr.accuracy}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-semibold text-emerald-600">
                        {attr.correct}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-red-600">
                        {attr.incorrect}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground font-medium">
                        {attr.unmarked}
                      </TableCell>
                      <TableCell className="text-right pr-6 font-semibold text-foreground/70">
                        {attr.totalTraces}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="xl:hidden flex flex-col divide-y">
              {sortedAttributes.map((attr: DashboardStats["attributes"][0], idx: number) => (
                <div key={`attr-card-${attr.name}-${idx}`} className="p-4 bg-white/40 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-semibold text-foreground/90 max-w-[70%]">{attr.name}</span>
                    <Badge 
                      variant={(attr.accuracy > 80 ? "success" : attr.accuracy > 50 ? "warning" : "destructive") as "default" | "secondary" | "destructive" | "outline" | "success" | "warning"}
                      className="font-bold"
                    >
                      {attr.accuracy}%
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3 pt-1">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase font-medium text-muted-foreground">Total Traces</span>
                      <span className="font-bold text-sm">{attr.totalTraces}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-2 border-t border-dashed">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-600 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {attr.correct} Correct
                    </div>
                    <div className="flex items-center gap-1.5 font-bold text-red-600 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      {attr.incorrect} Incorrect
                    </div>
                    <div className="flex items-center gap-1.5 font-bold text-muted-foreground text-xs ml-auto">
                      {attr.unmarked} ?
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </TabsContent>

        {currentUser.role === "power_user" && (
          <TabsContent value="users" className="animate-in slide-in-from-right-2 duration-300">
            <Card className="shadow-sm border-border bg-card overflow-hidden">
              <CardHeader className="border-b bg-muted/10 pb-4">
                <CardTitle className="text-lg font-semibold">User Performance Tracking</CardTitle>
                <CardDescription>Individual precision metrics and processing volume across the team.</CardDescription>
              </CardHeader>
              
              {isUsersStatsLoading && !usersStats ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Loading user performance...</p>
                </div>
              ) : (
                <>
                  <UserPerformanceTable stats={usersStats || []} />
                  <UserPerformanceMobile stats={usersStats || []} />
                </>
              )}
            </Card>
          </TabsContent>
        )}

        <TabsContent value="chart" className="space-y-4 animate-in slide-in-from-left-2 duration-300">
          <Card className="shadow-sm border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7 border-b mb-6 bg-muted/5">
              <div>
                <CardTitle className="text-lg">Attribute Performance</CardTitle>
                <CardDescription>Visual accuracy percentage by category</CardDescription>
              </div>
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="w-full pt-4" style={{ height: Math.max(400, attributes.length * 45) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sortedAttributes} layout="vertical" margin={{ left: 60, right: 80, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.1} />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={typeof window !== 'undefined' && window.innerWidth < 1280 ? 100 : 160} 
                      fontSize={typeof window !== 'undefined' && window.innerWidth < 1280 ? 9 : 11} 
                      axisLine={false}
                      tickLine={false}
                      className="font-medium text-foreground/70"
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--card)', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    />
                    <Bar dataKey="accuracy" radius={[0, 6, 6, 0]} barSize={28}>
                      <LabelList 
                        dataKey="accuracy" 
                        position="right" 
                        formatter={(val: unknown) => `${val}%`}
                        style={{ fontSize: '12px', fontWeight: '800', fill: 'var(--foreground)' }}
                        offset={15}
                      />
                      {attributes.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.accuracy > 80 ? '#10b981' : entry.accuracy > 50 ? '#f59e0b' : '#ef4444'} 
                          fillOpacity={0.9}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
