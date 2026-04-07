"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useCurrentUser } from "@/components/current-user-provider";
import axios from "axios";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, Info, ChevronDown, FileVideo, CheckCircle2, XCircle, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn, humanizeDateTime, extractFilenames } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ResultJson } from "@/app/traces/[id]/components/types";
import { PaginationControls } from "@/components/ui/table";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

interface Result {
  id: string;
  videoId: string;
  status: string;
  regionName: string;
  containerType: string;
  model: string;
  createdByUserId: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  videoName: string;
  customId: string;
  createdAt: string;
  json: ResultJson;
}

interface ResultsApiResponse {
  items: Result[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface ResultsTableProps {
  pollingMs?: number;
}

const TraceDataCell = ({ 
  value, 
  showLabels = true, 
  mono = false,
  labelClassName = "" 
}: { 
  value: string; 
  showLabels?: boolean; 
  mono?: boolean;
  labelClassName?: string;
}) => {
  const values = String(value || "").split(',');
  return (
    <div className="flex flex-col gap-2">
      {values.map((v, i) => {
        if (i > 1) return null; // Only support Interior/Exterior
        const type = i === 0 ? "Interior :" : "Exterior :";
        return (
          <div key={i} className="flex flex-col">
            {showLabels && (
              <span className={cn(
                "uppercase text-[11px] font-normal mb-0.5",
                labelClassName || "text-muted-foreground"
              )}>
                {type}
              </span>
            )}
            <span className={cn(
              "leading-tight text-foreground",
              mono ? "font-mono text-[10px]" : "text-sm font-normal"
            )}>
              {v || "N/A"}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const StatusBadge = ({ status, error }: { status: string; error?: string }) => {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", className: string, icon?: boolean }> = {
    completed: { 
      variant: "outline", 
      className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium" 
    },
    processing: { 
      variant: "outline", 
      className: "bg-blue-500/10 text-blue-600 border-blue-500/20 font-medium",
      icon: true
    },
    failed: { 
      variant: "destructive", 
      className: "font-medium" 
    }
  };

  const style = config[status] || { variant: "secondary", className: "" };

  return (
    <Badge
      variant={style.variant}
      className={cn("inline-flex items-center gap-1.5 capitalize py-0.5 px-2", style.className)}
    >
      {style.icon && <Loader2 className="h-3 w-3 animate-spin" />}
      {status}
      {error && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3.5 w-3.5 ml-1 cursor-help opacity-70 hover:opacity-100 transition-opacity" />
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs max-w-xs">{error}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </Badge>
  );
};

export function ResultsTable({ pollingMs = 10000 }: ResultsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read initial state from URL
  const initialPage = Number(searchParams.get("page")) || 1;
  const initialSearch = searchParams.get("search") || "";

  const [page, setPage] = useState(initialPage);
  const [search, setSearch] = useState(initialSearch);
  const pageSize = 10;

  // Sync state to URL when it changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (page > 1) params.set("page", page.toString());
    else params.delete("page");

    if (search) params.set("search", search);
    else params.delete("search");

    const currentQuery = searchParams.toString();
    const newQuery = params.toString();
    
    // Only update if the URL actually needs to change
    if (currentQuery !== newQuery) {
      const queryString = newQuery ? `?${newQuery}` : "";
      router.replace(`${pathname}${queryString}`, { scroll: false });
    }
  }, [page, search, pathname, router, searchParams]);

  const { currentUser } = useCurrentUser();
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["results", currentUser?.id, page, pageSize, search],
    queryFn: async () => {
      const response = await axios.get<ResultsApiResponse>("/api/results", {
        params: { page, pageSize, search: search || undefined },
      });
      return response.data;
    },
    refetchInterval: (query) => {
      const hasProcessing = query.state.data?.items?.some(
        (item) => item.status === "processing",
      );
      return hasProcessing ? pollingMs : false;
    },
    placeholderData: keepPreviousData,
  });

  const queryClient = useQueryClient();

  // PREFETCHING: Silent background fetch of the next page to make pagination feel instant
  useEffect(() => {
    if (data?.pagination?.page && data.pagination.page < data.pagination.totalPages) {
      const nextPage = data.pagination.page + 1;
      queryClient.prefetchQuery({
        queryKey: ["results", currentUser?.id, nextPage, pageSize, search],
        queryFn: async () => {
          const response = await axios.get<ResultsApiResponse>("/api/results", {
            params: { page: nextPage, pageSize, search: search || undefined },
          });
          return response.data;
        },
      });
    }
  }, [data, page, pageSize, search, queryClient, currentUser?.id]);

  // VIDEO PREFETCHING: Batch sign video URLs for the current page
  useEffect(() => {
    if (!data?.items?.length || !currentUser?.id) return;

    const signVideosBatch = async () => {
      // 1. Collect all unique S3 URIs from the current table page
      const s3Uris = new Set<string>();
      data.items.forEach(item => {
        if (item.videoId?.startsWith("s3://")) {
          item.videoId.split(',').forEach(uri => {
            const trimmed = uri.trim();
            if (trimmed.startsWith("s3://")) s3Uris.add(trimmed);
          });
        }
      });

      if (s3Uris.size === 0) return;

      try {
        // 2. Call the new batch presign API
        const { data: batchData } = await axios.post<{ results: { uri: string; url: string | null }[] }>(
          "/api/s3/presigned-batch",
          { s3Uris: Array.from(s3Uris), region: undefined }
        );

        // 3. Populate the React Query cache for each individual video
        batchData.results.forEach(({ uri, url }) => {
          if (url) {
            queryClient.setQueryData(
              ["presign-video", currentUser.id, uri, undefined],
              url,
              { updatedAt: Date.now() }
            );
          }
        });
      } catch (err) {
        console.error("Video batch prefetch failed:", err);
      }
    };

    signVideosBatch();
  }, [data?.items, currentUser?.id, queryClient]);


  const currentPage = data?.pagination.page ?? 1;
  const totalPages = data?.pagination.totalPages ?? 1;
  const totalItems = data?.pagination.total ?? 0;

  return (
    <div className="rounded-md xl:border xl:bg-white border-none bg-transparent">
      <div className="border-b px-2 xl:px-0 py-3 flex justify-start">
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search by Trace ID..."
          className="max-w-xs xl:max-w-sm"
        />
        {isFetching && (
          <div className="flex items-center gap-2 ml-4 text-[10px] font-medium text-muted-foreground animate-pulse">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            Refreshing data...
          </div>
        )}
      </div>
      <div className="hidden xl:block">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Trace ID / Source</TableHead>
            <TableHead>Region</TableHead>
            <TableHead>Container Type</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created By</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && !data ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8">
                <div className="flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Loading initial results...</span>
                </div>
              </TableCell>
            </TableRow>
          ) : !data?.items?.length ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8">
                No results found. Start by processing a new video.
              </TableCell>
            </TableRow>
          ) :
            data?.items?.map((result: Result) => (
              <TableRow key={result.id}>
                <TableCell className="max-w-[300px] whitespace-normal break-all">
                  <div className="flex flex-col gap-1 min-w-0">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {result.customId || "N/A"}
                            </span>
                            <div className="flex flex-col gap-2">
                              {(result.videoName || extractFilenames(result.videoId))
                                .split(',')
                                .map((name, i) => {
                                  if (i > 1) return null;
                                  const label = i === 0 ? "Interior :" : "Exterior :";
                                  return (
                                    <div key={i} className="flex flex-col">
                                      <span className="uppercase text-[11px] font-normal mb-0.5 text-muted-foreground">
                                        {label}
                                      </span>
                                      <span className="text-xs text-muted-foreground truncate max-w-[200px] leading-tight font-normal">
                                        {name.trim() || "N/A"}
                                      </span>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <p className="text-xs break-all">
                            {(result.videoName || result.videoId)}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </TableCell>
                <TableCell>
                  <TraceDataCell value={result.regionName} labelClassName="text-transparent select-none" />
                </TableCell>
                <TableCell>
                  <TraceDataCell value={result.containerType} labelClassName="text-transparent select-none" />
                </TableCell>
                <TableCell>
                  <TraceDataCell value={result.model} labelClassName="text-transparent select-none" />
                </TableCell>
                <TableCell>
                  <StatusBadge status={result.status} error={(result.json as { error?: string })?.error} />
                </TableCell>
                <TableCell className="text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {result.createdByName || "Unknown user"}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {result.createdByEmail || "N/A"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {humanizeDateTime(result.createdAt, "dd MMM yy, h:mm a")}
                </TableCell>
                <TableCell className="text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href={`/traces/${result.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View Details</span>
                          </Button>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>View Details</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
        </Table>
      </div>

      {/* Mobile Card Layout */}
      <div className="xl:hidden flex flex-col gap-4 pt-2">
        {isLoading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Loading results...
          </div>
        ) : !data?.items?.length ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No results found. Start by processing a new video.
          </div>
        ) : (
          data.items.map((result: Result) => (
            <MobileResultCard key={result.id} result={result} />
          ))
        )}
      </div>
      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    </div>
  );
}

function MobileResultCard({ result }: { result: Result }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getProp = (val: string | null | undefined, index: number) => String(val || "").split(',')[index];
  
  const items = ["Interior", "Exterior"].map((type, i) => ({
    type,
    vid: getProp(result.videoName || extractFilenames(result.videoId), i),
    reg: getProp(result.regionName, i),
    mod: getProp(result.model, i),
    con: getProp(result.containerType, i),
  })).filter(item => item.vid || item.con || item.reg || item.mod);

  return (
    <div className="rounded-xl p-4 bg-card shadow-md flex flex-col gap-3.5 text-card-foreground border xl:border-none">
      <div className="flex justify-between items-center border-b pb-2">
        <span className="text-xs text-muted-foreground font-normal uppercase tracking-wider">Trace Details</span>
        <div className="flex items-center gap-2">
          <StatusBadge status={result.status} />
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 -mr-1 rounded-full hover:bg-muted text-muted-foreground transition-colors focus:outline-none">
            <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 relative pt-1 pb-1">
        {items.map((item) => (
          <div key={item.type} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-normal uppercase tracking-widest text-foreground opacity-90">{item.type}</span>
              <div className="h-px flex-1 bg-border/40" />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] uppercase font-normal text-muted-foreground">Trace ID</span>
                <span className="font-mono text-sm text-foreground mt-0.5">
                  {result.customId || "N/A"}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[11px] uppercase font-normal text-muted-foreground">Container</span>
                <span className="text-sm font-normal text-foreground">{item.con || "N/A"}</span>
              </div>

              {isExpanded && (
                <div className="flex flex-col gap-3 pt-3 border-t border-border/40 animate-in fade-in slide-in-from-top-1">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] uppercase font-normal text-muted-foreground">Video Source</span>
                    <span className="text-sm font-normal text-foreground break-all leading-tight">
                      {item.vid || "N/A"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] uppercase font-normal text-muted-foreground">Region</span>
                    <span className="text-sm font-normal text-foreground">{item.reg || "N/A"}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] uppercase font-normal text-muted-foreground">Model</span>
                    <span className="text-sm font-normal text-foreground">{item.mod || "N/A"}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t pt-3 mt-1">
        <div className="flex flex-col">
          <span className="text-xs uppercase font-normal text-muted-foreground mb-1">Created By</span>
          <span className="text-sm font-normal leading-none text-foreground">
            {result.createdByName || "Unknown user"}
          </span>
          <span className="text-xs text-muted-foreground tracking-tight mt-1.5">
            {humanizeDateTime(result.createdAt, "dd MMM yy, h:mm a")}
          </span>
        </div>
        <Button 
          size="sm" 
          asChild 
          variant="outline" 
          className="h-8 shadow-sm px-4 rounded-lg text-sm font-semibold tracking-wide border-primary/20 hover:border-primary/50 text-primary hover:bg-primary/5 transition-all duration-200"
        >
          <Link href={`/traces/${result.id}`} className="flex items-center">
            <Eye className="h-3.5 w-3.5 mr-2" />
            View
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function RowValue({ value }: { value: string }) {
  if (value && value.trim().length > 0) return value;
  return <span className="text-muted-foreground text-xs">N/A</span>;
}
