"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { RefObject } from "react";

interface VideoPreviewPanelProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  videoSource?: string | null;
  regionName?: string | null;
}

export function VideoPreviewPanel({
  videoRef,
  videoSource,
  regionName,
}: VideoPreviewPanelProps) {
  const source = (videoSource || "").trim();
  const resolvedRegion = (regionName || "").trim() || undefined;
  const isS3Source = source.startsWith("s3://");

  const { data: signedVideoUrl, isLoading: isSigningVideo } = useQuery({
    queryKey: ["presign-video", source, resolvedRegion],
    queryFn: async () => {
      const response = await fetch("/api/s3/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s3Uri: source, region: resolvedRegion }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate video URL");
      }
      const data = (await response.json()) as { url: string };
      return data.url;
    },
    enabled: Boolean(source) && isS3Source,
    staleTime: 55 * 60 * 1000,
  });

  const videoUrl = isS3Source ? (signedVideoUrl ?? null) : (source || null);

  return (
    <div className="min-h-0 flex-1 h-full w-full">
      <div className="h-full overflow-hidden  bg-black flex items-center justify-center">
        {isSigningVideo ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating video link...
          </div>
        ) : null}
        {videoUrl ? (
          <video ref={videoRef} controls className="w-full h-full object-cover" muted loop>
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : !isSigningVideo ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            Video unavailable
          </div>
        ) : null}
      </div>
    </div>
  );
}

