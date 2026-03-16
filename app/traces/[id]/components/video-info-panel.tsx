"use client";

import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { ResultDetail } from "./types";
import { cn, humanizeDateTime, extractFilenames } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VideoInfoPanelProps {
  result: ResultDetail;
  type: "interior" | "exterior";
}

function formatValue(value?: string | null) {
  if (!value || value.trim().length === 0) return "N/A";
  return value;
}

export function VideoInfoPanel({ result, type }: VideoInfoPanelProps) {
  const videoInfo = result.json.video || {};

  const getProp = (val: string | null | undefined, index: number) => String(val || "").split(',')[index];
  const rawName = getProp(result.videoName || extractFilenames(result.videoId), type === "interior" ? 0 : 1);

  const items = [
    {
      label: "Trace ID",
      value: formatValue(result.customId),
      mono: true,
      bold: true
    },
    {
      label: "Video Source",
      value: rawName || "N/A",
      mono: false,
    },
    {
      label: "Region",
      value: formatValue(type === "interior" ? videoInfo.interior_region : videoInfo.exterior_region),
    },
    {
      label: "Container Type",
      value: formatValue(videoInfo.container_type),
    },
    {
      label: "Created At",
      value: humanizeDateTime(result.createdAt, "dd MMM yy, h:mm a"),
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
              "md:max-w-60 md:truncate w-full break-words whitespace-normal text-foreground",
              item.mono
                ? "font-mono text-xs leading-5"
                : "text-sm leading-5 font-normal",
              item.bold && "font-bold text-sm"
            )}
          >
            {item.value}
          </p>
        );

        return (
          <div key={item.label} className="space-y-1">
            <p className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
              {item.label}
            </p>
            {('tooltip' in item && item.tooltip) ? (
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
        <p className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
          Status
        </p>
        <Badge
          variant={
            result.status === "failed" ? "destructive" : "outline"
          }
          className={cn(
            "inline-flex h-5 items-center gap-1.5 text-xs capitalize py-0.5 px-2 font-medium",
            result.status === "completed" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
            result.status === "processing" && "bg-blue-500/10 text-blue-600 border-blue-500/20"
          )}
        >
          {result.status === "processing" && (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
          {result.status}
        </Badge>
      </div>
    </>
  );
}

