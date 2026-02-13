"use client";

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
import { Loader2 } from "lucide-react";

interface Result {
  id: string;
  videoId: string;
  status: string;
  createdAt: string;
}

export function ResultsTable() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["results"],
    queryFn: async () => {
      const response = await axios.get("/api/results");
      return response.data;
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

  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Video ID (S3 URI)</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Created At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map((result: Result) => (
            <TableRow key={result.id}>
              <TableCell className="font-mono text-[10px] max-w-[400px] truncate">
                {result.videoId}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    result.status === "completed" ? "default" : "secondary"
                  }
                >
                  {result.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground transition-colors group-hover:text-foreground">
                {new Date(result.createdAt).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
          {data?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={3}
                className="text-center py-10 text-muted-foreground"
              >
                No results found. Start by processing a new video.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
