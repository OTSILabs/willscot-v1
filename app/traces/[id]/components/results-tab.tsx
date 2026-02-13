"use client";

import { ReactNode, useMemo, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RawJsonTab } from "./raw-json-tab";
import { ResultDetail, TraceAttribute } from "./types";

interface ResultsTabProps {
  result: ResultDetail;
  middleHeader?: ReactNode;
  middleMode?: "results" | "raw-json";
}

function formatMeta(value?: string | null) {
  if (!value || value.trim().length === 0) return "N/A";
  return value;
}

function toTitleCase(value?: string | null) {
  const raw = formatMeta(value);
  if (raw === "N/A") return "NA";

  return raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function ResultsTab({
  result,
  middleHeader,
  middleMode = "results",
}: ResultsTabProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<{
    url: string;
    second: number;
  } | null>(null);

  const attributes = useMemo(() => {
    const list = result.json.attributes;
    return Array.isArray(list) ? (list as TraceAttribute[]) : [];
  }, [result.json.attributes]);
  const videoInfo = result.json.video || {};

  function handleFrameClick(attribute: TraceAttribute) {
    const frameUrl = attribute.frame_s3_uri_url || "";
    const second = Number(attribute.timestamp_seconds ?? 0);

    if (frameUrl) {
      setSelectedFrame({ url: frameUrl, second });
    }

    if (videoRef.current && Number.isFinite(second)) {
      videoRef.current.currentTime = Math.max(0, second);
    }
  }

  return (
    <div className="h-[calc(100vh-230px)] min-h-[620px] rounded-md border">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize={18} minSize={14}>
          <div className="h-full overflow-auto border-r p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Video Information
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  S3 Uri
                </p>
                <p className="mt-1 break-all font-mono leading-5">
                  {formatMeta(videoInfo.s3_uri || result.videoId)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Region
                </p>
                <p className="mt-1 leading-5">{formatMeta(videoInfo.region)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Container Type
                </p>
                <p className="mt-1 leading-5">{toTitleCase(videoInfo.container_type)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Created At
                </p>
                <p className="mt-1 leading-5">
                  {new Date(result.createdAt).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Created By
                </p>
                <p className="mt-1 leading-5">
                  {result.createdByName || "Unknown"}
                  <br />
                  <span className="text-muted-foreground">
                    {result.createdByEmail || "N/A"}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Status
                </p>
                <Badge
                  variant={result.status === "completed" ? "default" : "secondary"}
                  className="mt-1 h-5 text-xs capitalize"
                >
                  {result.status}
                </Badge>
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={50} minSize={36}>
          <div className="flex h-full min-h-0 flex-col">
            {middleHeader ? <div className="border-b p-2">{middleHeader}</div> : null}
            <div className="min-h-0 flex-1 overflow-auto">
              {middleMode === "results" ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead>Attribute</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Evidence</TableHead>
                      <TableHead className="w-24">Frame</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attributes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No attributes found in response.
                        </TableCell>
                      </TableRow>
                    ) : (
                      attributes.map((attribute, index) => {
                        const second = Number(attribute.timestamp_seconds ?? 0);
                        const hasFrame = Boolean(attribute.frame_s3_uri_url);

                        return (
                          <TableRow
                            key={`${attribute.pipeline}-${attribute.attribute}-${index}`}
                          >
                            <TableCell>{toTitleCase(attribute.pipeline)}</TableCell>
                            <TableCell>{toTitleCase(attribute.attribute)}</TableCell>
                            <TableCell>{formatMeta(attribute.value)}</TableCell>
                            <TableCell className="max-w-[320px] whitespace-normal wrap-break-word text-muted-foreground">
                              {formatMeta(attribute.evidence)}
                            </TableCell>
                            <TableCell>
                              {hasFrame ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleFrameClick(attribute)}
                                >
                                  {second}s
                                </Button>
                              ) : (
                                <span className="text-muted-foreground text-xs">N/A</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-2">
                  <RawJsonTab resultId={result.id} payload={result} />
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={32} minSize={24}>
          <div className="flex h-full flex-col gap-3 p-3">
            <div className="min-h-0 flex-1 rounded-md border p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Selected Frame Preview
              </p>
              {selectedFrame?.url ? (
                <div className="flex h-[calc(100%-22px)] flex-col gap-2">
                  <div className="text-xs text-muted-foreground">
                    Timestamp: {selectedFrame.second}s
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedFrame.url}
                      alt={`Frame at ${selectedFrame.second}s`}
                      className="h-full w-full object-contain"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Click a frame time in the table to preview the image and seek video.
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 rounded-md border p-3">
              <div className="h-[calc(100%-24px)] overflow-hidden rounded-md bg-black">
                {result.videoUrl ? (
                  <video ref={videoRef} controls className="h-full w-full">
                    <source src={result.videoUrl} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                    Video unavailable
                  </div>
                )}
              </div>
              {result.videoUrl ? (
                <a
                  href={result.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="size-3" />
                  Open video source
                </a>
              ) : null}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

