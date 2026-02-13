"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  FileJson,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  MonitorPlay,
  Plane,
  ShieldCheck,
  Video,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

interface Result {
  id: string;
  videoId: string;
  status: string;
  json: Record<string, any>;
  videoUrl?: string; // Pre-signed URL from backend
  createdAt: string;
}

/**
 * Recursively extracts all image URLs ending in _url from the processed JSON
 */
function extractAllImages(obj: any): string[] {
  const images = new Set<string>();
  const walk = (o: any) => {
    if (!o || typeof o !== "object") return;

    if (Array.isArray(o)) {
      o.forEach((item) => {
        if (
          typeof item === "object" &&
          item.url &&
          (item.original?.toLowerCase().endsWith(".jpg") ||
            item.original?.toLowerCase().endsWith(".png") ||
            item.original?.toLowerCase().endsWith(".jpeg"))
        ) {
          images.add(item.url);
        } else {
          walk(item);
        }
      });
      return;
    }

    for (const [key, value] of Object.entries(o)) {
      if (
        key.endsWith("_url") &&
        typeof value === "string" &&
        (value.toLowerCase().includes(".jpg") ||
          value.toLowerCase().includes(".png") ||
          value.toLowerCase().includes(".jpeg"))
      ) {
        images.add(value);
      } else if (typeof value === "object") {
        walk(value);
      }
    }
  };
  walk(obj);
  return Array.from(images);
}

export default function ResultDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const {
    data: result,
    isLoading,
    error,
  } = useQuery<Result>({
    queryKey: ["result", id],
    queryFn: async () => {
      const response = await axios.get(`/api/results/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">
          Fetching analysis results...
        </p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="container mx-auto py-20 px-4">
        <Card className="max-w-md mx-auto border-destructive/50 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <ShieldCheck className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Error Loading Result</CardTitle>
            <CardDescription>
              We couldn&apos;t find the result you&apos;re looking for or
              something went wrong.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => router.push("/dashboard")}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allImages = extractAllImages(result.json);

  return (
    <div className="container mx-auto py-8 px-4 space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors group mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              Analysis Result
            </h1>
            <Badge
              variant={result.status === "completed" ? "default" : "secondary"}
              className="h-6 capitalize"
            >
              {result.status}
            </Badge>
          </div>
          <p className="text-muted-foreground font-mono text-sm truncate max-w-[500px]">
            {result.videoId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a
              href={result.videoUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Raw S3 Source
            </a>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:w-[400px] mb-6">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="media" className="flex items-center gap-2">
            <MonitorPlay className="h-4 w-4" />
            Media
          </TabsTrigger>
          <TabsTrigger value="json" className="flex items-center gap-2">
            <FileJson className="h-4 w-4" />
            Raw JSON
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Plane className="h-3 w-3" />
                      Model
                    </p>
                    <p className="font-medium">{result.json?.model || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      Created At
                    </p>
                    <p className="font-medium">
                      {new Date(result.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Video className="h-3 w-3" />
                      Container Type
                    </p>
                    <p className="font-medium capitalize">
                      {result.json?.container_type || "N/A"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      Region
                    </p>
                    <p className="font-medium">
                      {result.json?.region_name || "us-west-2"}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Analysis Summary
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-primary/5">
                      {allImages.length} Frame Extractions Found
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Status Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-center py-6">
                <div className="inline-flex items-center justify-center p-4 rounded-full bg-primary/10 mb-2">
                  {result.status === "completed" ? (
                    <ShieldCheck className="h-8 w-8 text-primary" />
                  ) : (
                    <Clock className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <h3 className="font-bold text-xl uppercase tracking-wider">
                  {result.status}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {result.status === "completed"
                    ? "The video has been successfully processed and analyzed."
                    : "The video is currently being processed or pending."}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="media" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Video Player</CardTitle>
              <CardDescription>Source: {result.videoId}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-black rounded-lg overflow-hidden border shadow-inner">
                {result.videoUrl ? (
                  <video controls className="w-full h-full">
                    <source src={result.videoUrl} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="flex h-full items-center justify-center p-8 text-white text-center">
                    <div>
                      <Video className="mx-auto h-12 w-12 mb-4 opacity-20" />
                      <p className="text-zinc-500">
                        Video source is not available or protocol not supported.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Frames & Detections
              </CardTitle>
              <CardDescription>
                Visual artifacts extracted by the AI models.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allImages.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {allImages.map((imageUrl, index) => (
                    <div
                      key={index}
                      className="aspect-square bg-muted rounded-md overflow-hidden border group relative shadow-sm hover:shadow-md transition-shadow"
                    >
                      <img
                        src={imageUrl}
                        alt={`Detection ${index}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                      <a
                        href={imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm p-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-medium"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open Original
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="aspect-[4/1] bg-muted rounded-md flex items-center justify-center border-2 border-dashed">
                  <div className="text-center">
                    <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground mb-2 opacity-30" />
                    <p className="text-xs text-muted-foreground italic">
                      No image artifacts found in extraction JSON.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="json">
          <Card className="overflow-hidden border-zinc-200 dark:border-zinc-800">
            <CardHeader className="bg-zinc-50 dark:bg-zinc-900 border-b py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-mono">
                  raw_payload.json
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      JSON.stringify(result.json, null, 2),
                    );
                  }}
                >
                  Copy
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="p-4 overflow-auto max-h-[600px] text-[12px] font-mono leading-relaxed bg-zinc-900 text-zinc-300">
                {JSON.stringify(result.json, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
