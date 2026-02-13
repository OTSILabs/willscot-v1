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
import { Loader2, Eye } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
            <TableHead>Created At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
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
                  className="capitalize"
                >
                  {result.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(result.createdAt).toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href={`/dashboard/${result.id}`}>
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
          {data?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
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
