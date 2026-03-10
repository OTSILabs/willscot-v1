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
    <div className="rounded-md md:border bg-white">
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
                <TableCell className="font-mono text-[10px] max-w-[300px] whitespace-normal break-all">
                  <div className="flex flex-col gap-4">
                    {result.videoId.toString().split(',').map((v, i) => <div key={i}>{v}</div>)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-4">
                    {result.regionName.toString().split(',').map((v, i) => <div key={i}>{v}</div>)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-4">
                    {result.containerType.toString().split(',').map((v, i) => <div key={i}>{v}</div>)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-4">
                    {result.model.toString().split(',').map((v, i) => <div key={i}>{v}</div>)}
                  </div>
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
      <div className="md:hidden flex flex-col gap-4 mb-4 pt-2">
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
            <div key={result.id} className="rounded-xl p-4 bg-card shadow-sm flex flex-col gap-4">
              <div className="flex justify-between items-start gap-2">
                <div className="font-mono text-[10px] break-all max-w-[70%]">
                  {result.videoId.toString().split(',').map((v, i) => <div key={i}>{v}</div>)}
                </div>
                <Badge
                  variant={result.status === "completed" ? "default" : "secondary"}
                  className="inline-flex items-center gap-1 capitalize shrink-0"
                >
                  {result.status === "processing" && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  {result.status}
                  {result.json?.error && (
                    <Tooltip>
                      <TooltipTrigger><Info className="h-3 w-3" /></TooltipTrigger>
                      <TooltipContent><p>{result.json?.error}</p></TooltipContent>
                    </Tooltip>
                  )}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-1 uppercase tracking-wider font-semibold text-[10px]">Region</span>
                  <div className="font-medium">
                    {result.regionName.toString().split(',').map((v, i) => <div key={i}>{v}</div>)}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1 uppercase tracking-wider font-semibold text-[10px]">Model</span>
                  <div className="font-medium">
                    {result.model.toString().split(',').map((v, i) => <div key={i}>{v}</div>)}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block mb-1 uppercase tracking-wider font-semibold text-[10px]">Container Type</span>
                  <div className="font-medium">
                    {result.containerType.toString().split(',').map((v, i) => <div key={i}>{v}</div>)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-3 mt-2">
                <div className="flex flex-col">
                  <span className="text-xs font-medium">
                    {result.createdByName || "Unknown user"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(result.createdAt).toLocaleString()}
                  </span>
                </div>
                <Button size="sm" asChild variant="outline" className="h-8 shadow-sm">
                  <Link href={`/traces/${result.id}`}>
                    <Eye className="h-3 w-3 mr-1.5" />
                    View
                  </Link>
                </Button>
              </div>
            </div>
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

export function RowValue({ value }: { value: string }) {
  if (value && value.trim().length > 0) return value;
  return <span className="text-muted-foreground text-xs">N/A</span>;
}