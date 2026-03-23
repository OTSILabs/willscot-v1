"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { RefObject, useEffect, useState } from "react";

interface VideoPreviewPanelProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  videoSource?: string | null;
  regionName?: string | null;
  seekTo?: { timestamp: number; id: number } | null;
}

export function VideoPreviewPanel({
  videoRef,
  videoSource,
  regionName,
  seekTo,
}: VideoPreviewPanelProps) {
  const [isBuffering, setIsBuffering] = useState(false);
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

  // Handle seeking
  useEffect(() => {
    if (seekTo && videoRef.current) {
      const video = videoRef.current;
      const seek = () => {
        console.log(`[VideoPreview] Seeking to ${seekTo.timestamp}s (id: ${seekTo.id})`);
        video.currentTime = seekTo.timestamp;
        
        // Force play after seek to ensure the user sees the frame
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.warn("Autoplay after seek prevented/failed:", error);
          });
        }
      };

      // In production, we need to be very sure the video is ready to receive a seek
      if (video.readyState >= 1) {
        seek();
      } else {
        video.addEventListener("loadedmetadata", seek, { once: true });
      }
    }
  }, [seekTo, videoRef, videoUrl]);

  return (
    <div className="relative min-h-0 flex-1 h-full w-full">
      <div className="h-full overflow-hidden bg-black flex items-center justify-center">
        {isSigningVideo || (isBuffering && videoUrl) ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[1px] text-sm text-zinc-100">
            <div className="flex items-center bg-zinc-900/80 px-4 py-2 rounded-full border border-zinc-700 shadow-xl">
              <Loader2 className="mr-2.5 h-4 w-4 animate-spin text-blue-400" />
              {isSigningVideo ? "Generating video link..." : "Buffering video..."}
            </div>
          </div>
        ) : null}
        
        {videoUrl ? (
          <video 
            ref={videoRef} 
            src={videoUrl}
            controls 
            playsInline
            preload="metadata"
            className="w-full h-full object-cover" 
            muted 
            loop
            onWaiting={() => setIsBuffering(true)}
            onPlaying={() => setIsBuffering(false)}
            onSeeked={() => setIsBuffering(false)}
          >
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

