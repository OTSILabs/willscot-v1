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
import { 
  BarChart3, 
  TableProperties,
  HelpCircle, 
  TrendingUp, 
  RotateCcw,
  ShieldCheck,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Suspense } from "react";
import { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { format } from "date-fns";
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { Filter, X } from "lucide-react";
import { useCurrentUser } from "@/components/current-user-provider";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

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
  const [userId, setUserId] = useState<string>(searchParams.get("userId") || "all");
  
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

  // Helper to update URL search params
  const updateQueryParams = useCallback((updates: Record<string, string | null>) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "all" || value === "") {
        current.delete(key);
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
      userId,
      startDate,
      endDate,
    });
  }, [userId, startDate, endDate, updateQueryParams]);

  useEffect(() => {
    if (currentUser && currentUser.role !== "power_user") {
      router.push("/traces");
    }
  }, [currentUser, router]);

  const { data: usersData } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => {
      const resp = await axios.get("/api/users?pageSize=100");
      return resp.data.items as Array<{ id: string, name: string }>;
    },
    enabled: !!currentUser && currentUser.role === "power_user",
  });

  const timezone = typeof window !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  const { data, isLoading, isError, refetch } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats", userId, startDate, endDate, timezone],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userId && userId !== "all") params.append("userId", userId);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("timezone", timezone);
      
      const resp = await axios.get(`/api/stats/dashboard?${params.toString()}`);
      return resp.data;
    },
    refetchInterval: 10000, // Live updates every 10 seconds
    enabled: !!currentUser && currentUser.role === "power_user",
  });

  if (!currentUser) return <DashboardLoading />;
  if (currentUser.role !== "power_user") return <DashboardLoading />;

  if (isLoading) return <DashboardLoading />;
  if (isError || !data) return <DashboardError onRetry={() => refetch()} />;

  const { overview, attributes } = data;

  return (
    <div className="mx-auto py-4 md:py-10 space-y-6 md:space-y-8 animate-in fade-in duration-700 relative">
      {/* Back Button in the left corner */}
      <div className="absolute top-2 left-0 md:-left-4">
        <BackButton label="Traces" className="hover:bg-transparent" />
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-10 md:pt-8">
        <div className="space-y-1">
          <PageTitle title="Attribute Accuracy" />
          <PageDescription description="Monitor and review progress across all analyzed videos." />
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-emerald-500/5 text-emerald-600 border-emerald-200 animate-pulse px-3 py-1">
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
            className="w-fit shadow-sm"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-end gap-3 mb-6 mt-4">
        <div className="flex flex-col md:flex-row items-center gap-2 bg-white/50 border border-dashed rounded-lg p-1.5 shadow-sm">
          <div className="flex items-center gap-2 px-2 md:border-r border-border/50 w-full md:w-auto">
            <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger id="user-filter" className="bg-transparent border-0 h-8 text-xs w-full md:w-[130px] shadow-none focus:ring-0">
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {usersData?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 px-2 w-full md:w-auto md:border-l border-border/50">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest hidden md:inline ml-1">Date</span>
            <div className="flex items-center gap-1 flex-1">
              <DatePickerWithRange date={dateRange} setDate={setDateRange} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          {(userId !== "all" || startDate || endDate) && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setUserId("all");
                setDateRange(undefined);
              }}
              className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3 mr-1" />
              Clear
            </Button>
          )}
          <Button 
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            className="h-8 px-4 text-xs shadow-sm border border-secondary"
          >
            <Filter className="w-3 h-3 mr-1.5" />
            Apply
          </Button>
        </div>
      </div>

      {/* Metric Cards - Summary Tier */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard 
          title="Overall Accuracy" 
          value={overview.overall.accuracy} 
          subtitle={`${overview.overall.correct} approved`}
          icon={<Zap className="w-5 h-5 text-yellow-500" />}
        />
        <MetricCard 
          title="Interior " 
          value={overview.interior.accuracy} 
          subtitle="Internal Attributes"
          icon={<ShieldCheck className="w-5 h-5 text-blue-500" />}
        />
        <MetricCard 
          title="Exterior " 
          value={overview.exterior.accuracy} 
          subtitle="External Attributes"
          icon={<ShieldCheck className="w-5 h-5 text-emerald-500" />}
        />
      </div>

      {/* View Toggle Section */}
      <Tabs defaultValue="table" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid grid-cols-2 w-[300px]">
            <TabsTrigger value="table">
              <TableProperties className="w-4 h-4 mr-2" />
              Table View
            </TabsTrigger>
            <TabsTrigger value="chart">
              <BarChart3 className="w-4 h-4 mr-2" />
              Chart View
            </TabsTrigger>
          </TabsList>
          <div className="hidden md:block text-xs text-muted-foreground font-medium bg-muted/50 px-3 py-1.5 rounded-full">
            {attributes.length} Monitoring Categories
          </div>
        </div>

        <TabsContent value="table" className="animate-in slide-in-from-right-2 duration-300">
          <Card className="shadow-sm border-border bg-card overflow-hidden">
            <CardHeader className="border-b bg-muted/10 pb-4">
              <CardTitle className="text-lg font-semibold">Detailed Accuracy Breakdown</CardTitle>
              <CardDescription>Granular review progress and counts for all attributes</CardDescription>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/5">
                    <TableHead className="pl-6 py-4 font-bold text-foreground">Category Name</TableHead>
                    <TableHead className="text-center font-bold text-foreground">Accuracy</TableHead>
                    <TableHead className="text-center font-bold text-foreground">Correct</TableHead>
                    <TableHead className="text-center font-bold text-foreground">Incorrect</TableHead>
                    <TableHead className="text-center font-bold text-foreground">Unmarked</TableHead>
                    <TableHead className="text-right pr-6 font-bold text-foreground">Total Traces</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attributes.map((attr) => (
                    <TableRow key={attr.name} className="hover:bg-muted/10 transition-colors group border-b last:border-0">
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
          </Card>
        </TabsContent>

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
                  <BarChart data={attributes} layout="vertical" margin={{ left: 60, right: 80, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.1} />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={160} 
                      fontSize={11} 
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

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon 
}: { 
  title: string; 
  value: number; 
  subtitle: string; 
  icon: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm border-border bg-card hover:shadow-md transition-all duration-300 hover:-translate-y-1">
      <CardHeader className="pb-6">
        <div className="flex justify-between items-start">
          <div className="p-2.5 rounded-xl bg-muted/60 shadow-inner border border-border/40">{icon}</div>
          <div className="text-4xl font-extrabold tracking-tighter text-foreground">{value}%</div>
        </div>
        <CardTitle className="text-lg mt-5 capitalize font-bold leading-none">{title}</CardTitle>
        <CardDescription className="text-xs text-muted-foreground font-medium mt-1.5">{subtitle}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function DashboardLoading() {
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

function DashboardError({ onRetry }: { onRetry: () => void }) {
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
