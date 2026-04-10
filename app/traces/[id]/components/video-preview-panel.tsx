"use client";

import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/components/current-user-provider";
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
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);

  const rawSource = (videoSource || "").trim();
  const sources = rawSource.split(',').map(s => s.trim()).filter(Boolean);
  const source = sources[activeVideoIndex] || sources[0] || "";
  
  const resolvedRaw = (regionName || "").trim();
  const regions = resolvedRaw.split(',').map(r => r.trim());
  const resolvedRegion = regions[activeVideoIndex] || regions[0] || undefined;
  
  const isS3Source = source.startsWith("s3://");

  const { currentUser } = useCurrentUser();
  const { data: signedVideoUrl, isLoading: isSigningVideo } = useQuery({
    queryKey: ["presign-video", currentUser?.id, source, resolvedRegion],
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
    <div className="relative min-h-0 flex-1 h-full w-full flex flex-col">
      {/* Multi-video selector overlay */}
      {sources.length > 1 && (
        <div className="absolute top-3 left-3 z-30 flex gap-1.5 p-1 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 shadow-xl">
          {sources.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setActiveVideoIndex(idx);
                setIsBuffering(false);
              }}
              className={cn(
                "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all",
                activeVideoIndex === idx 
                  ? "bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                  : "text-zinc-400 hover:text-white hover:bg-white/10"
              )}
            >
              Part {idx + 1}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-hidden bg-black flex items-center justify-center relative">
          {(isSigningVideo || isBuffering) && videoUrl ? (
            <div className="absolute inset-x-0 bottom-12 z-20 flex justify-center pointer-events-none">
              <div className="flex items-center bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Loader2 className="mr-2.5 h-3.5 w-3.5 animate-spin text-blue-400" />
                <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                  {isSigningVideo ? "Signing Link..." : "Buffering..."}
                </span>
              </div>
            </div>
          ) : isSigningVideo && !videoUrl ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
              <span className="text-xs font-bold text-white uppercase tracking-widest opacity-80">Preparing Video</span>
            </div>
          ) : null}
          
          {videoUrl ? (
            <video 
              key={videoUrl} // Key change forces re-render/source reset
              ref={videoRef} 
              src={videoUrl}
              controls 
              autoPlay
              playsInline
              preload="auto"
              className="w-full h-full object-cover shadow-2xl" 
              muted 
              loop
              onLoadStart={() => setIsBuffering(true)}
              onWaiting={() => setIsBuffering(true)}
              onPlaying={() => setIsBuffering(false)}
              onSeeked={() => setIsBuffering(false)}
              onCanPlayThrough={() => setIsBuffering(false)}
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

