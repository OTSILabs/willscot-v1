"use client";

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { VideoInfoPanel } from "./components/video-info-panel";
import { AttributesTable } from "./components/attributes-table";
// import { FramePreviewPanel } from "./components/frame-preview-panel";
import { VideoPreviewPanel } from "./components/video-preview-panel";
import { RawJsonTab } from "./components/raw-json-tab";
import { ResultDetail, TraceAttribute } from "./components/types";
import { toast } from "sonner";

const DETAIL_POLLING_MS = 10000;

export default function ResultDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : undefined;
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // const [selectedFrame, setSelectedFrame] = useState<{
  //   source: string;
  //   second: number;
  // } | null>(null);

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
  const videoRegion = result.json.video?.region || null;
  const videoSource = result.json.video?.s3_uri || result.videoId || result.videoUrl || null;

  // function handleFrameClick(attribute: TraceAttribute) {
  //   const frameSource = attribute.frame_s3_uri || attribute.frame_s3_uri_url || "";
  //   const second = Number(attribute.timestamp_seconds ?? 0);

  //   if (frameSource) {
  //     setSelectedFrame({ source: frameSource, second });
  //   }

  //   if (videoRef.current && Number.isFinite(second)) {
  //     videoRef.current.currentTime = Math.max(0, second);
  //   }
  // }

  async function handleFeedbackChange(index: number, newAttribute: TraceAttribute) {
    if (!result) return;
    const currentAttributes = [...(result.json.attributes || [])] as TraceAttribute[];

    if (index >= 0 && index < currentAttributes.length) {
      currentAttributes[index] = newAttribute;
      try {
        await axios.patch(`/api/results/${id}`, {
          attributes: currentAttributes
        });
        refetch();
      } catch {
        toast.error("Failed to update feedback", {
          description: "Please try again!",
        });
      }
    }
  }

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-between">

        <VideoInfoPanel result={result} />

        <Button variant="outline" size="sm" asChild>
          <Link
            href="/traces"
            className="inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="results" className="w-full">
        {isProcessing ? (
          <div className="h-[calc(100vh-100px)] min-h-[calc(100vh-100px)] rounded-md border">
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm font-medium">Video is processing...</p>
              <p className="text-xs text-muted-foreground">
                This page refreshes automatically and will show results once processing is
                complete.
              </p>
            </div>
          </div>
        ) : (
          <div className="h-[calc(100vh-100px)] min-h-[calc(100vh-100px)] rounded-md border">
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
                      // onFrameClick={handleFrameClick}
                      onAttributeUpdate={handleFeedbackChange}
                    />
                  </TabsContent>

                  <TabsContent value="raw-json" className="m-0 min-h-0 flex-1 overflow-auto p-2">
                    <RawJsonTab resultId={result.id} payload={result} />
                  </TabsContent>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={30} minSize={0}>
                {/* <Tabs defaultValue="video" className="flex h-full min-h-0 flex-col"> */}
                {/* <div className="border-b">
                    <TabsList variant="line" className="grid w-[220px] grid-cols-2">
                      <TabsTrigger value="video">Video</TabsTrigger>
                      {/* <TabsTrigger value="frame">Frame</TabsTrigger> */}
                {/* </TabsList> */}
                {/* </div> */}

                {/* <TabsContent value="frame" className="m-0 min-h-0 flex-1 overflow-auto">
                    <div className="flex h-full min-h-0">
                      <FramePreviewPanel
                        selectedFrame={selectedFrame}
                        regionName={videoRegion}
                      />
                    </div>
                  </TabsContent> */}

                {/* <TabsContent value="video" className="m-0 min-h-0 flex-1 overflow-auto"> */}
                <div className="flex h-full min-h-0">
                  <VideoPreviewPanel
                    videoRef={videoRef}
                    videoSource={videoSource}
                    regionName={videoRegion}
                  />
                </div>
                {/* </TabsContent> */}
                {/* </Tabs> */}
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        )}

      </Tabs>
    </div>
  );
}
