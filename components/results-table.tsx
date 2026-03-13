"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Loader2, Eye, Info, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ResultJson } from "@/app/traces/[id]/components/types";
import { PaginationControls } from "@/components/ui/table";

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
                "uppercase text-[8px] font-bold mb-0.5",
                labelClassName || "text-muted-foreground"
              )}>
                {type}
              </span>
            )}
            <span className={cn(
              "leading-tight",
              mono ? "font-mono text-[10px]" : "text-xs font-medium"
            )}>
              {v || "N/A"}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export function ResultsTable({ pollingMs = 10000 }: ResultsTableProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const pageSize = 10;

  const { data, isLoading } = useQuery({
    queryKey: ["results", page, pageSize, search],
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
  });


  const currentPage = data?.pagination.page ?? 1;
  const totalPages = data?.pagination.totalPages ?? 1;
  const totalItems = data?.pagination.total ?? 0;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="rounded-md md:border md:bg-white border-none bg-transparent">
      <div className="border-b p-3">
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search by Video ID..."
          className="max-w-sm"
        />
      </div>
      <div className="hidden md:block">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Video ID (S3 URI)</TableHead>
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
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8">
                Loading results...
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
                  <TraceDataCell value={result.videoId} mono />
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
                  <Badge
                    variant={
                      result.status === "completed" ? "default" : "secondary"
                    }
                    className="inline-flex items-center gap-1 capitalize"
                  >
                    {result.status === "processing" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : null}
                    {result.status}
                    {
                      result.json?.error && <Tooltip>
                        <TooltipTrigger><Info className="h-3 w-3" /></TooltipTrigger>
                        <TooltipContent><p>{result.json?.error}</p></TooltipContent>
                      </Tooltip>
                    }
                  </Badge>
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
                  {new Date(result.createdAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
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
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
        </Table>
      </div>

      {/* Mobile Card Layout */}
      <div className="md:hidden flex flex-col gap-4 pt-2">
        {isLoading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Loading results...
          </div>
        ) : !data?.items?.length ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No results found. Start by processing a new video.
          </div>
        ) : (
          data.items.map((result: Result) => {
            return (
              <div key={result.id} className="rounded-xl p-3 bg-card shadow-sm flex flex-col gap-2.5 text-card-foreground border md:border-none">
                <div className="flex justify-between items-center border-b pb-1.5">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Trace Details</span>
                  <Badge
                    variant={result.status === "completed" ? "default" : "secondary"}
                    className="inline-flex items-center gap-1 capitalize shrink-0 shadow-sm text-[10px] py-0 px-2 h-4.5"
                  >
                    {result.status === "processing" && (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    )}
                    {result.status}
                  </Badge>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-foreground opacity-90 underline underline-offset-4 decoration-border/40">Trace Details</span>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2 pl-1">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[7.5px] uppercase font-bold text-muted-foreground opacity-60">Video Sources</span>
                      <TraceDataCell value={result.videoId} mono labelClassName="text-muted-foreground" />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col">
                        <span className="text-[7.5px] uppercase font-bold text-muted-foreground opacity-60">Region</span>
                        <TraceDataCell value={result.regionName} showLabels={false} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[7.5px] uppercase font-bold text-muted-foreground opacity-60">Model</span>
                        <TraceDataCell value={result.model} showLabels={false} />
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[7.5px] uppercase font-bold text-muted-foreground opacity-60">Container Type</span>
                      <TraceDataCell value={result.containerType} showLabels={false} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t pt-2 mt-0.5">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-semibold leading-none">
                      {result.createdByName || "Unknown user"}
                    </span>
                    <span className="text-[8.5px] text-muted-foreground uppercase tracking-tight mt-1">
                      {new Date(result.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                  <Button size="sm" asChild variant="outline" className="h-7 shadow-sm px-2.5 rounded-lg text-[11px] font-bold">
                    <Link href={`/traces/${result.id}`}>
                      <Eye className="h-3 w-3 mr-1" />
                      Details
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })
        )}      </div>
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

export function RowValue({ value }: { value: string }) {
  if (value && value.trim().length > 0) return value;
  return <span className="text-muted-foreground text-xs">N/A</span>;
}