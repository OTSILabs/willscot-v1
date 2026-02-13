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
import { Loader2, Eye } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Result {
  id: string;
  videoId: string;
  status: string;
  createdByUserId: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: string;
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

  const { data, isLoading, error } = useQuery({
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading results...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 text-destructive">
        Failed to load results.
      </div>
    );
  }

  const currentPage = data?.pagination.page ?? 1;
  const totalPages = data?.pagination.totalPages ?? 1;
  const totalItems = data?.pagination.total ?? 0;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="rounded-md border bg-white">
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Video ID (S3 URI)</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created By</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.items?.map((result: Result) => (
            <TableRow key={result.id}>
              <TableCell className="font-mono text-[10px] max-w-[400px] truncate">
                {result.videoId}
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
          {data?.items?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center py-10 text-muted-foreground"
              >
                No results found. Start by processing a new video.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between border-t px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Showing {startItem}-{endItem} of {totalItems}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage <= 1}
          >
            Previous
          </Button>
          <p className="text-sm text-muted-foreground">
            Page {currentPage} / {totalPages}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setPage((prev) =>
                Math.min(totalPages, prev + 1),
              )
            }
            disabled={currentPage >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
