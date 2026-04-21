"use client";

import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/components/current-user-provider";
import { ExternalLink, Loader2, ImageIcon, ZoomIn, XIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ImagePreviewPanelProps {
  s3Uri?: string | null;
  signedUrl?: string | null;
  regionName?: string | null;
  attributeName?: string | null;
}

export function ImagePreviewPanel({
  s3Uri,
  signedUrl,
  regionName,
  attributeName,
}: ImagePreviewPanelProps) {
  const source = (s3Uri || "").trim();
  const isS3Source = source.startsWith("s3://");

  // Handle comma-separated regions (common in this codebase)
  const resolvedRegion = (regionName || "").split(",")[0].trim() || "us-west-2";

  const { currentUser } = useCurrentUser();
  const { data: signedImageUrl, isLoading: isSigningImage, error } = useQuery({
    queryKey: ["presign-image", currentUser?.id, source, resolvedRegion],
    queryFn: async () => {
      const response = await fetch("/api/s3/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s3Uri: source, region: resolvedRegion }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate image URL");
      }
      const data = (await response.json()) as { url: string };
      return data.url;
    },
    enabled: Boolean(source) && isS3Source && !signedUrl,
    staleTime: 55 * 60 * 1000,
  });

  const imageUrl = signedUrl || (isS3Source ? (signedImageUrl ?? null) : (source || null));

  if (!source) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-zinc-500 gap-4 bg-zinc-900/5 dark:bg-zinc-900/40">
        <div className="p-4 rounded-full bg-zinc-100 dark:bg-zinc-800 shadow-inner">
          <ImageIcon className="h-10 w-10 opacity-20" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-zinc-400 uppercase tracking-widest">No Selection</p>
          <p className="text-xs text-zinc-500 mt-1">Select a damage item to view the frame</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1 h-full w-full flex flex-col bg-black overflow-hidden group">
      {/* Header Overlay */}
      <div className="absolute top-0 inset-x-0 z-30 p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none transition-opacity duration-300">
         <div className="flex items-center justify-between">
            <div className="bg-blue-500/20 backdrop-blur-md px-3 py-1 rounded-full border border-blue-500/30">
               <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">{attributeName || "Damage Frame"}</span>
            </div>
            {imageUrl && (
              <a 
                href={imageUrl} 
                target="_blank" 
                rel="noreferrer"
                className="pointer-events-auto p-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-all backdrop-blur-md"
                title="Open in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
         </div>
      </div>

      <div className="flex-1 flex items-center justify-center relative min-h-0 overflow-hidden">
        {isSigningImage ? (
           <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm gap-3">
             <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
             <span className="text-xs font-bold text-white uppercase tracking-widest opacity-80">Loading Frame</span>
           </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <div className="p-3 rounded-full bg-red-500/10 border border-red-500/20 text-red-500">
              <XIcon className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-zinc-300">Failed to load preview</p>
            <p className="text-xs text-zinc-500">The S3 resource may be unavailable or expired.</p>
          </div>
        ) : imageUrl ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <img 
              src={imageUrl} 
              alt={attributeName || "Damage frame"}
              className="max-w-full max-h-full object-contain shadow-2xl animate-in fade-in duration-500" 
            />
            
            {/* Hover Interaction Overlay */}
            <div className="absolute inset-x-0 bottom-0 p-8 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <div className="bg-black/60 backdrop-blur-xl px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-3 shadow-2xl scale-95 group-hover:scale-100 transition-transform">
                    <ZoomIn className="h-4 w-4 text-blue-400" />
                    <span className="text-xs font-medium text-white">Click row items to switch views</span>
                </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
