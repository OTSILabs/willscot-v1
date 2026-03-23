"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MessageSquare } from "lucide-react";
import { BackButton } from "@/components/back-button";
import Link from "next/link";
import { PageTitle } from "@/components/typography";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { VideoInfoPanel } from "./components/video-info-panel";
import { AttributesTable } from "./components/attributes-table";
import { VideoPreviewPanel } from "./components/video-preview-panel";
import { RawJsonTab } from "./components/raw-json-tab";
import { ResultDetail, TraceAttribute } from "./components/types";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const DETAIL_POLLING_MS = 10000;

export default function ResultDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : undefined;
  const router = useRouter();
  const interiorVideoRef = useRef<HTMLVideoElement | null>(null);
  const exteriorVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoSectionRef = useRef<HTMLDivElement | null>(null);

  const {
    data: result,
    isLoading,
    error,
    refetch,
  } = useQuery<ResultDetail>({
    queryKey: ["result", id],
    queryFn: async () => {
      const response = await axios.get(`/api/results/${id}`);
      return response.data;
    },
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ? DETAIL_POLLING_MS : false,
  });

  const [type, setType] = useState<"interior" | "exterior">("interior");
  const [activeSeek, setActiveSeek] = useState<{ timestamp: number; source: "interior" | "exterior"; id: number } | null>(null);

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading result...</span>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Unable to load this result.</p>
        <Button onClick={() => router.push("/traces")}>Return to Traces</Button>
      </div>
    );
  }

  const list = result.json.attributes;
  const attributes = Array.isArray(list) ? (list as TraceAttribute[]) : [];
  const isProcessing = result.status === "processing";
  const isFailed = result.status === "failed";

  async function handleFeedbackChange(index: number, newAttribute: TraceAttribute) {
    const currentAttributes = [...(result?.json.attributes || [])] as TraceAttribute[];
    if (index < 0 || index >= currentAttributes.length) return;

    currentAttributes[index] = newAttribute;
    try {
      await axios.patch(`/api/results/${id}`, { attributes: currentAttributes });
      refetch();
    } catch {
      toast.error("Failed to update feedback", { description: "Please try again!" });
    }
  }

  const handleTimestampClick = (timestamp: number, source: string) => {
    const s = (source.toLowerCase() === "exterior" ? "exterior" : "interior") as "interior" | "exterior";
    setType(s);
    setActiveSeek({ timestamp, source: s, id: Date.now() });

    // Auto-scroll to video section on mobile
    if (window.innerWidth < 768 && videoSectionRef.current) {
      videoSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const VideoPreviewTabs = ({ isMobile = false }: { isMobile?: boolean }) => (
    <Tabs 
      defaultValue="interior" 
      value={type} 
      onValueChange={(v) => setType(v as "interior" | "exterior")} 
      className={isMobile ? "w-full mt-4" : "flex h-full min-h-0 flex-col"}
    >
      <div className={!isMobile ? "border-b" : ""}>
        <TabsList variant={!isMobile ? "line" : undefined} className={!isMobile ? "grid w-[220px] grid-cols-2" : "grid w-full grid-cols-2 mb-2"}>
          <TabsTrigger value="interior">{isMobile ? "Interior Video" : "Interior"}</TabsTrigger>
          <TabsTrigger value="exterior">{isMobile ? "Exterior Video" : "Exterior"}</TabsTrigger>
        </TabsList>
      </div>

      <div className={isMobile ? "aspect-video w-full rounded-lg overflow-hidden bg-black shadow-sm" : "flex-1 min-h-0"}>
        {(["interior", "exterior"] as const).map((t) => (
          <TabsContent key={t} value={t} className="m-0 h-full w-full overflow-auto">
            {(() => {
              const videoObj = result.json.video;
              // 1. Try interior_s3_uri_url (pre-signed by API)
              // 2. Fallback to raw interior_s3_uri (needs client-side presign)
              // 3. Last fallback to top-level videoId
              const source = 
                (videoObj?.[`${t}_s3_uri_url` as keyof typeof videoObj] as string) ||
                (videoObj?.[`${t}_s3_uri` as keyof typeof videoObj] as string) ||
                (result.json[`${t}_jobs` as keyof typeof result.json] as any)?.[0]?.s3_uri_url ||
                (result.json[`${t}_jobs` as keyof typeof result.json] as any)?.[0]?.s3_uri ||
                result.videoUrl || 
                result.videoId;

              return (
                <VideoPreviewPanel
                  videoRef={t === "interior" ? interiorVideoRef : exteriorVideoRef}
                  videoSource={source}
                  regionName={videoObj?.[`${t}_region` as keyof typeof videoObj] as string || result.regionName}
                  seekTo={activeSeek?.source === t ? { timestamp: activeSeek.timestamp, id: activeSeek.id } : null}
                />
              );
            })()}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );

  return (
    <div className="space-y-4 md:space-y-6 py-4">
      {/* Desktop/Mobile Common Back Button */}
      <div className="flex items-center gap-4">
        <BackButton label="Back to Traces" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Mobile Header per reference - Title only now */}
        <div className="md:hidden flex items-center gap-3 border-b pb-3 -mx-4 px-4">
          <PageTitle title="Trace Details" />
        </div>

        {/* Desktop elements and info container */}
        <div className="flex flex-col md:flex-row md:items-center w-full justify-between gap-4">
          <div className="flex flex-col md:flex-row gap-4 md:gap-8 w-full border-b pb-4 md:border-0 md:pb-0">
            <VideoInfoPanel result={result} type={type} />
          </div>
        </div>
      </div>
      {
        isFailed ? <Alert className="border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-50">
          <AlertTitle>Failed</AlertTitle>
          <AlertDescription>
            {result.json.error}
          </AlertDescription>
        </Alert> : (
          <Tabs defaultValue="results" className="w-full">
            {isProcessing ? (
              <div className="md:h-[calc(100vh-100px)] md:min-h-[calc(100vh-100px)] rounded-md border p-8 md:p-0">
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="text-sm font-normal md:font-medium">Video is processing...</p>
                  <p className="text-xs text-muted-foreground">
                    This page refreshes automatically and will show results once processing is
                    complete.
                  </p>
                </div>
              </div>
            ) : (
              <div className="md:h-[calc(100vh-100px)] md:min-h-[calc(100vh-100px)] md:rounded-md md:border flex flex-col md:block">
                {/* Desktop Resizable View */}
                <div className="hidden md:block h-full">
                  <ResizablePanelGroup orientation="horizontal">
                    <ResizablePanel defaultSize={70} minSize={0}>
                      <div className="flex h-full min-h-0 flex-col">
                        <div className="border-b">
                          <TabsList variant="line" className="grid w-[260px] grid-cols-2">
                            <TabsTrigger value="results">Results</TabsTrigger>
                            <TabsTrigger value="raw-json">Raw Json</TabsTrigger>
                          </TabsList>
                        </div>

                        <TabsContent value="results" className="m-0 min-h-0 flex-1 overflow-auto">
                          <AttributesTable
                            attributes={attributes}
                            onAttributeUpdate={handleFeedbackChange}
                            onTimestampClick={handleTimestampClick}
                          />
                        </TabsContent>

                        <TabsContent value="raw-json" className="m-0 min-h-0 flex-1 overflow-auto p-0">
                          <RawJsonTab resultId={result.id} payload={result} />
                        </TabsContent>
                      </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    <ResizablePanel defaultSize={30} minSize={0}>
                      <VideoPreviewTabs />
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </div>

                {/* Mobile Stacked View */}
                <div className="md:hidden flex flex-col gap-6">
                  {/* Video Preview with Tab switch */}
                  <div ref={videoSectionRef} className="scroll-mt-4">
                    <VideoPreviewTabs isMobile />
                  </div>

                  {/* Results Section */}
                  <div>
                    <h2 className="font-semibold mb-3 border-b pb-2">Extracted Attributes</h2>
                    <AttributesTable
                      attributes={attributes}
                      onAttributeUpdate={handleFeedbackChange}
                      onTimestampClick={handleTimestampClick}
                    />
                  </div>
                </div>
              </div>
            )}

          </Tabs>
        )
      }
    </div>
  );
}
