"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MessageSquare } from "lucide-react";
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
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Mobile Header per reference */}
        <div className="md:hidden flex items-center gap-3 border-b pb-3 -mx-4 px-4">
          <Link href="/traces">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="font-semibold text-lg">Trace Details</span>
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
                  <p className="text-sm font-medium">Video is processing...</p>
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
                          />
                        </TabsContent>

                        <TabsContent value="raw-json" className="m-0 min-h-0 flex-1 overflow-auto p-0">
                          <RawJsonTab resultId={result.id} payload={result} />
                        </TabsContent>
                      </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    <ResizablePanel defaultSize={30} minSize={0}>
                      <Tabs defaultValue="interior" value={type} onValueChange={(value) => setType(value as "interior" | "exterior")} className="flex h-full min-h-0 flex-col">
                        <div className="border-b">
                          <TabsList variant="line" className="grid w-[220px] grid-cols-2">
                            <TabsTrigger value="interior">Interior</TabsTrigger>
                            <TabsTrigger value="exterior">Exterior</TabsTrigger>
                          </TabsList>
                        </div>

                        <TabsContent value="exterior" className="m-0 min-h-0 flex-1 overflow-auto">
                          <div className="flex h-full min-h-0">
                            <VideoPreviewPanel
                              videoRef={videoRef}
                              videoSource={result.json.video?.exterior_s3_uri}
                              regionName={result.json.video?.exterior_region}
                            />
                          </div>
                        </TabsContent>

                        <TabsContent value="interior" className="m-0 min-h-0 flex-1 overflow-auto">
                          <div className="flex h-full min-h-0">
                            <VideoPreviewPanel
                              videoRef={videoRef}
                              videoSource={result.json.video?.interior_s3_uri}
                              regionName={result.json.video?.interior_region}
                            />
                          </div>
                        </TabsContent>
                      </Tabs>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </div>

                {/* Mobile Stacked View */}
                <div className="md:hidden flex flex-col gap-6">
                  {/* Video Preview with Tab switch */}
                  <Tabs defaultValue="interior" value={type} onValueChange={(value) => setType(value as "interior" | "exterior")} className="w-full mt-4">
                    <TabsList className="grid w-full grid-cols-2 mb-2">
                      <TabsTrigger value="interior">Interior Video</TabsTrigger>
                      <TabsTrigger value="exterior">Exterior Video</TabsTrigger>
                    </TabsList>
                    
                    <div className="aspect-video w-full rounded-lg overflow-hidden bg-black shadow-sm">
                      <TabsContent value="exterior" className="m-0 h-full w-full">
                        <VideoPreviewPanel
                          videoRef={videoRef}
                          videoSource={result.json.video?.exterior_s3_uri}
                          regionName={result.json.video?.exterior_region}
                        />
                      </TabsContent>
                      <TabsContent value="interior" className="m-0 h-full w-full">
                        <VideoPreviewPanel
                          videoRef={videoRef}
                          videoSource={result.json.video?.interior_s3_uri}
                          regionName={result.json.video?.interior_region}
                        />
                      </TabsContent>
                    </div>
                  </Tabs>

                  {/* Results Section */}
                  <div>
                    <h2 className="font-semibold mb-3 border-b pb-2">Extracted Attributes</h2>
                    <AttributesTable
                      attributes={attributes}
                      onAttributeUpdate={handleFeedbackChange}
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
