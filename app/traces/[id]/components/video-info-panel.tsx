"use client";

import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { ResultDetail } from "./types";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VideoInfoPanelProps {
  result: ResultDetail;
}

function formatValue(value?: string | null) {
  if (!value || value.trim().length === 0) return "N/A";
  return value;
}

export function VideoInfoPanel({ result }: VideoInfoPanelProps) {
  const videoInfo = result.json.video || {};

  const items = [
    {
      label: "S3 URI",
      value: formatValue(videoInfo.s3_uri || result.videoId),
      mono: true,
      tooltip: true
    },
    {
      label: "Region",
      value: formatValue(videoInfo.region),
    },
    {
      label: "Container Type",
      value: formatValue(videoInfo.container_type),
    },
    {
      label: "Created At",
      value: new Date(result.createdAt).toLocaleString(),
    },
    {
      label: "Created By",
      value: `${result.createdByName || "Unknown"} (${result.createdByEmail || "N/A"})`,
    },
  ];

  return (
    <>
      {items.map((item) => {
        const valueElement = (
          <p
            className={cn(
              "max-w-60 truncate",
              item.mono
                ? "break-all font-mono text-xs leading-5"
                : "text-xs leading-5"
            )}
          >
            {item.value}
          </p>
        );

        return (
          <div key={item.label} className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            {item.tooltip ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {valueElement}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.value}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              valueElement
            )}
          </div>
        );
      })}
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Status
        </p>
        <Badge
          variant={result.status === "completed" ? "default" : "secondary"}
          className="inline-flex h-5 items-center gap-1 text-xs capitalize"
        >
          {result.status === "processing" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : null}
          {result.status}
        </Badge>
      </div>
    </>
  );
}

