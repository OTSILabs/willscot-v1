"use client";

import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/components/current-user-provider";
import { Loader2, ImageIcon, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface PhotoEvidenceItemProps {
  s3Uri: string | { original: string; url: string };
  index: number;
  regionName?: string | null;
}

export function PhotoEvidenceItem({ s3Uri, index, regionName }: PhotoEvidenceItemProps) {
  const { currentUser } = useCurrentUser();
  
  // Defensive check for s3Uri to handle both strings and objects { original, url }
  const source = typeof s3Uri === "string" 
    ? s3Uri.trim() 
    : (s3Uri && typeof s3Uri === "object" && "original" in s3Uri)
      ? String((s3Uri as any).original || "").trim()
      : "";

  const resolvedRaw = typeof regionName === "string" ? regionName.trim() : "us-west-2";
  const resolvedRegion = resolvedRaw.split(',')[0].trim() || "us-west-2";
  // Safe signing: split by comma if multiple URIs are provided (batch result artifacts)
  const cleanSource = source.split(',')[0].trim();
  const isS3Source = cleanSource.startsWith("s3://");
  
  // Extract signed URL from complex object if available, checking both 'url' and 'original_url'
  const preSignedUrl = (s3Uri && typeof s3Uri === "object")
    ? (("url" in s3Uri && (s3Uri as any).url) || ("original_url" in s3Uri && (s3Uri as any).original_url) || undefined)
    : undefined;

  const { data: signedUrl, isLoading, error } = useQuery({
    queryKey: ["presign-photo", currentUser?.id, cleanSource, resolvedRegion],
    queryFn: async () => {
      console.log(`[PhotoEvidence] Presigning S3 URI:`, cleanSource);
      const response = await fetch("/api/s3/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s3Uri: cleanSource, region: resolvedRegion }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[PhotoEvidence] Presign API error:`, errorData);
        throw new Error("Failed to generate photo URL");
      }
      const data = (await response.json()) as { url: string };
      return data.url;
    },
    initialData: typeof preSignedUrl === "string" ? preSignedUrl : undefined,
    enabled: Boolean(cleanSource) && isS3Source && !preSignedUrl,
    staleTime: 55 * 60 * 1000,
  });

  const photoUrl = isS3Source ? (signedUrl || preSignedUrl || "") : source;

  if (isLoading && !photoUrl) {
    return (
      <div className="group relative aspect-video overflow-hidden rounded-xl border bg-muted flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !photoUrl) {
    return (
      <div className="group relative aspect-video overflow-hidden rounded-xl border bg-muted flex flex-col items-center justify-center gap-2 text-muted-foreground p-4">
        <ImageIcon className="h-6 w-6 opacity-20" />
        <span className="text-[10px] text-center font-medium opacity-60">
          Failed to load photo evidence {index + 1}
        </span>
      </div>
    );
  }

  return (
    <div className="group relative aspect-video overflow-hidden rounded-xl border bg-muted shadow-sm hover:shadow-md transition-all">
      <Image
        src={photoUrl}
        alt={`Evidence ${index + 1}`}
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        priority={index < 4}
        loading={index < 4 ? undefined : "lazy"}
      />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Button variant="secondary" size="sm" onClick={() => window.open(photoUrl, "_blank")}>
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
          View Full size
        </Button>
      </div>
      <div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-sm">
        Photo Evidence {index + 1}
      </div>
    </div>
  );
}
