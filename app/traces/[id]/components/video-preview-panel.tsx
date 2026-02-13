"use client";

import { ExternalLink } from "lucide-react";
import { RefObject } from "react";

interface VideoPreviewPanelProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  videoUrl?: string | null;
}

export function VideoPreviewPanel({ videoRef, videoUrl }: VideoPreviewPanelProps) {
  return (
    <div className="min-h-0 flex-1">
      <div className="h-[calc(100%-30px)] overflow-hidden  bg-black flex items-center justify-center">
        {videoUrl ? (
          <video ref={videoRef} controls className="w-full aspect-video">
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            Video unavailable
          </div>
        )}
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

