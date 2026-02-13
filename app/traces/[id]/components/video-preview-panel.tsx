"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { RefObject } from "react";

interface VideoPreviewPanelProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  videoSource?: string | null;
}

export function VideoPreviewPanel({ videoRef, videoSource }: VideoPreviewPanelProps) {
  const source = (videoSource || "").trim();
  const isS3Source = source.startsWith("s3://");
  const { data: signedVideoUrl, isLoading: isSigningVideo } = useQuery({
    queryKey: ["presign-video", source],
    queryFn: async () => {
      const response = await fetch("/api/s3/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s3Uri: source }),
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
    <div className="min-h-0 flex-1">
      <div className="h-[calc(100%-30px)] overflow-hidden  bg-black flex items-center justify-center">
        {isSigningVideo ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating video link...
          </div>
        ) : null}
        {videoUrl ? (
          <video ref={videoRef} controls className="w-full aspect-video">
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : !isSigningVideo ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            Video unavailable
          </div>
        ) : null}
      </div>
      {videoUrl ? (
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="size-3" />
          Open video source
        </a>
      ) : null}
    </div>
  );
}

