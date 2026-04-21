"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/components/current-user-provider";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ImageIcon } from "lucide-react";
import { BackButton } from "@/components/back-button";
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
import { PhotoEvidenceItem } from "./components/photo-evidence-item";
import { ImagePreviewPanel } from "./components/image-preview-panel";
import { ResultDetail, TraceAttribute } from "./components/types";
import { toast } from "sonner";
import { getAttributeOrder } from "@/lib/constants";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useIsMobile } from "@/hooks/use-mobile";

const DETAIL_POLLING_MS = 10000;

type VideoPreviewTabsProps = {
  isMobile?: boolean;
  type: "interior" | "exterior";
  setType: (type: "interior" | "exterior") => void;
  interiorVideoRef: React.MutableRefObject<HTMLVideoElement | null>;
  exteriorVideoRef: React.MutableRefObject<HTMLVideoElement | null>;
  result: ResultDetail;
  activeSeek: { timestamp: number; source: "interior" | "exterior"; id: number } | null;
};

const VideoPreviewTabs = ({ isMobile = false, type, setType, interiorVideoRef, exteriorVideoRef, result, activeSeek }: VideoPreviewTabsProps) => (
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
          <VideoPreviewPanel
            videoRef={t === "interior" ? interiorVideoRef : exteriorVideoRef}
            videoSource={result.json.video?.[`${t}_s3_uri` as keyof typeof result.json.video] as string}
            regionName={result.json.video?.[`${t}_region` as keyof typeof result.json.video] as string}
            seekTo={activeSeek?.source === t ? { timestamp: activeSeek.timestamp, id: activeSeek.id } : null}
          />
        </TabsContent>
      ))}
    </div>
  </Tabs>
);

export default function ResultDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : undefined;
  const router = useRouter();
  const interiorVideoRef = useRef<HTMLVideoElement | null>(null);
  const exteriorVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoSectionRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();

  const { currentUser } = useCurrentUser();
  const {
    data: result,
    isLoading,
    error,
    refetch,
  } = useQuery<ResultDetail>({
    queryKey: ["result", currentUser?.id, id],
    queryFn: async () => {
      const response = await axios.get(`/api/results/${id}`);
      return response.data;
    },
    enabled: !!id,
    retry: (failureCount, error) => {
      // If it's a 404 from our API, it's likely DB lag - retry up to 5 times (total ~10-15s wait if needed)
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return failureCount < 5;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ? DETAIL_POLLING_MS : false,
  });

  const [type, setType] = useState<"interior" | "exterior">("interior");
  const [activeSeek, setActiveSeek] = useState<{ timestamp: number; source: "interior" | "exterior"; id: number } | null>(null);
  const isMobileView = useIsMobile();
  const [isTableCompact, setIsTableCompact] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState("results");
  const [selectedDamage, setSelectedDamage] = useState<TraceAttribute | null>(null);

  const { mutate: updateFeedback } = useMutation({
    mutationFn: async ({ newAttribute }: { newAttribute: TraceAttribute }) => {
      // Find and update the attribute in the raw JSON structure
      const currentAttributes = [...(result?.json.attributes || [])] as TraceAttribute[];
      
      const existingIdx = currentAttributes.findIndex(
        a => a.attribute === newAttribute.attribute && 
             a.source === newAttribute.source &&
             a.value === newAttribute.value &&
             a.timestamp_seconds === newAttribute.timestamp_seconds
      );

      if (existingIdx !== -1) {
        currentAttributes[existingIdx] = newAttribute;
      } else {
        // If it's a new attribute (e.g. from photo loads), add it to the main list
        currentAttributes.push(newAttribute);
      }

      const resp = await axios.patch(`/api/results/${id}`, { attributes: currentAttributes });
      return resp.data;
    },
    onMutate: async ({ newAttribute }) => {
      await queryClient.cancelQueries({ queryKey: ["result", currentUser?.id, id] });
      const previousResult = queryClient.getQueryData(["result", currentUser?.id, id]) as ResultDetail | undefined;

      if (previousResult) {
        const optimisticResult = JSON.parse(JSON.stringify(previousResult)) as ResultDetail;
        const attrs = [...(optimisticResult.json.attributes || [])];
        const idx = attrs.findIndex(
          a => a.attribute === newAttribute.attribute && 
               a.source === newAttribute.source &&
               a.value === newAttribute.value &&
               a.timestamp_seconds === newAttribute.timestamp_seconds
        );
        
        if (idx !== -1) {
          attrs[idx] = newAttribute;
        } else {
          attrs.push(newAttribute);
        }
        
        optimisticResult.json.attributes = attrs;
        queryClient.setQueryData(["result", currentUser?.id, id], optimisticResult);
      }

      return { previousResult };
    },
    onError: (err, variables, context) => {
      if (context?.previousResult) {
        queryClient.setQueryData(["result", currentUser?.id, id], context.previousResult);
      }
      toast.error("Failed to update feedback", { description: "Please try again!" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["result", currentUser?.id, id] });
      queryClient.invalidateQueries({ queryKey: ["results", currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats", currentUser?.id] });
    },
  });

  // Flatten attributes: combine top-level video attributes
  const attributes = useMemo(() => {
    if (!result?.json) return [] as TraceAttribute[];
    
    const list = [...(Array.isArray(result.json.attributes) ? result.json.attributes : [])];
    
    return (list as TraceAttribute[]).sort((a, b) => 
      getAttributeOrder(a.attribute) - getAttributeOrder(b.attribute)
    );
  }, [result?.json]);

  const damageAttributes = useMemo(() => {
    return attributes.filter(a => a.attribute === "DamageDetection");
  }, [attributes]);

  const standardAttributes = useMemo(() => {
    return attributes.filter(a => a.attribute !== "DamageDetection");
  }, [attributes]);

  // Set initial selected damage when data loads or damage attributes change
  useEffect(() => {
    if (damageAttributes.length > 0 && !selectedDamage) {
      setSelectedDamage(damageAttributes[0]);
    }
  }, [damageAttributes, selectedDamage]);

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

  const isProcessing = result.status === "processing";
  const isFailed = result.status === "failed";

  const handleTimestampClick = (timestamp: number, source: string) => {
    const s = (source.toLowerCase() === "exterior" ? "exterior" : "interior") as "interior" | "exterior";
    setType(s);
    setActiveSeek({ timestamp, source: s, id: Date.now() });

    // Auto-scroll to video section on mobile/tablet view
    if (isMobileView && videoSectionRef.current) {
      videoSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleViewImage = () => {
    setActiveMainTab("photos");
  };



  return (
    <div className="space-y-4 md:space-y-6 py-4">
      {/* Desktop/Mobile Common Back Button */}
      <div className="flex items-center gap-4">
        <BackButton label="Back to Traces" />
      </div>

      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Mobile Header per reference - Title only now */}
        <div className="xl:hidden flex items-center gap-3 border-b pb-3 -mx-4 px-4">
          <PageTitle title="Trace Details" />
        </div>

        {/* Desktop elements and info container */}
        <div className="flex flex-col xl:flex-row xl:items-center w-full justify-between gap-4">
          <div className="flex flex-col xl:flex-row gap-4 xl:gap-8 w-full border-b pb-4 xl:border-0 xl:pb-0">
            <VideoInfoPanel result={result} type={type} />
          </div>
        </div>
      </div>
      {
        isFailed ? (
          <Alert className="border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-50">
            <AlertTitle>Failed</AlertTitle>
            <AlertDescription>
              {result.json.error}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Partial Failures Alert */}
            {Array.isArray(result.json.failures) && result.json.failures.length > 0 && (
              <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
                <AlertTitle className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  Partial Failures Detected
                </AlertTitle>
                <AlertDescription className="mt-2 space-y-1">
                  <p className="text-xs opacity-80 mb-2">The following process tasks encountered issues:</p>
                  <ul className="list-disc list-inside text-xs space-y-1">
                    {result.json.failures.map((fail: any, idx: number) => (
                      <li key={`failure-${idx}-${fail.source}`}>
                        <span className="font-bold uppercase text-[10px]">{fail.source}:</span> {fail.error}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
            {isProcessing ? (
              <div className="xl:h-[calc(100vh-100px)] xl:min-h-[calc(100vh-100px)] rounded-md border p-8 xl:p-0">
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="text-sm font-normal xl:font-medium">Video is processing...</p>
                  <p className="text-xs text-muted-foreground">
                    This page refreshes automatically and will show results once processing is
                    complete.
                  </p>
                </div>
              </div>
            ) : (
              <div className="xl:h-[calc(100vh-100px)] xl:min-h-[calc(100vh-100px)] xl:rounded-md xl:border flex flex-col xl:block">
                {/* Conditionally render desktop OR mobile layout to prevent duplicate video refs */}
                {!isMobileView ? (
                  /* Desktop Resizable View */
                  <div className="hidden xl:block h-full">
                    <ResizablePanelGroup orientation="horizontal">
                        <ResizablePanel 
                        defaultSize={70} 
                        minSize={0}
                        onResize={(size) => setIsTableCompact((size as unknown as number) < 40)}
                      >
                        <div className="flex h-full min-h-0 flex-col">
                          <div className="border-b">
                            <TabsList variant="line" className="grid w-[480px] grid-cols-4">
                              <TabsTrigger value="results">Results</TabsTrigger>
                              <TabsTrigger value="damages">
                                Damages
                                {damageAttributes.length > 0 && (
                                  <span className="ml-1.5 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">
                                    {damageAttributes.length}
                                  </span>
                                )}
                              </TabsTrigger>
                              <TabsTrigger value="photos">
                                Photos
                                {(() => {
                                  const aiImage = result.json.video?.image_s3_uri ? 1 : 0;
                                  const extraPhotos = (result.json.evidencePhotos?.length || 0);
                                  // Since we now only allow 1 image total, we should show 1 if either exists.
                                  // But for backward compatibility with older traces, we use Math.max(1, count) or deduplicate.
                                  const photoCount = aiImage || extraPhotos ? Math.max(aiImage, extraPhotos) : 0;
                                  return photoCount > 0 && (
                                    <span className="ml-1.5 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">
                                      {photoCount}
                                    </span>
                                  );
                                })()}
                              </TabsTrigger>
                              <TabsTrigger value="raw-json">Raw Json</TabsTrigger>
                            </TabsList>
                          </div>
  
                          <TabsContent value="results" className="m-0 min-h-0 flex-1 overflow-auto">
                            <AttributesTable
                              attributes={standardAttributes}
                              onAttributeUpdate={(attr) => updateFeedback({ newAttribute: attr })}
                              onTimestampClick={handleTimestampClick}
                              onViewImage={handleViewImage}
                              isCompact={isTableCompact}
                              imageS3Uri={result.json.video?.image_s3_uri_url || result.json.video?.image_s3_uri}
                            />
                          </TabsContent>

                          <TabsContent value="damages" className="m-0 min-h-0 flex-1 overflow-auto">
                            <AttributesTable
                              attributes={damageAttributes}
                              onAttributeUpdate={(attr) => updateFeedback({ newAttribute: attr })}
                              onTimestampClick={handleTimestampClick}
                              onViewImage={handleViewImage}
                              onRowClick={(attr) => setSelectedDamage(attr)}
                              selectedAttribute={selectedDamage}
                              isCompact={isTableCompact}
                            />
                          </TabsContent>

                          <TabsContent value="photos" className="m-0 min-h-0 flex-1 overflow-auto p-6">
                            {result.json.video?.image_s3_uri || (result.json.evidencePhotos && result.json.evidencePhotos.length > 0) ? (
                              <div className="grid grid-cols-2 gap-4">
                                {result.json.video?.image_s3_uri ? (
                                  <PhotoEvidenceItem 
                                    key="main-image-evidence"
                                    s3Uri={result.json.video.image_s3_uri} 
                                    index={0} 
                                    regionName={result.regionName} 
                                  />
                                ) : (
                                  result.json.evidencePhotos?.map((photo: any, idx) => (
                                    <PhotoEvidenceItem 
                                      key={`photo-evidence-${idx}`} 
                                      s3Uri={typeof photo === 'string' ? photo : photo.original} 
                                      index={idx} 
                                      regionName={result.regionName} 
                                    />
                                  ))
                                )}
                              </div>
                            ) : (
                              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                                <ImageIcon className="h-10 w-10 opacity-20" />
                                <p className="text-sm font-medium">No photo evidence available</p>
                              </div>
                            )}
                          </TabsContent>
  
                          <TabsContent value="raw-json" className="m-0 min-h-0 flex-1 overflow-auto p-0">
                            <RawJsonTab resultId={result.id} payload={result} />
                          </TabsContent>
                        </div>
                      </ResizablePanel>
  
                      <ResizableHandle withHandle />
  
                      <ResizablePanel defaultSize={30} minSize={0}>
                        {activeMainTab === "damages" ? (
                           <ImagePreviewPanel 
                            s3Uri={selectedDamage?.frame_s3_uri} 
                            signedUrl={selectedDamage?.frame_s3_uri_url}
                            regionName={result.regionName}
                            attributeName={selectedDamage?.value}
                           />
                        ) : (
                          <VideoPreviewTabs 
                            type={type} 
                            setType={setType}
                            interiorVideoRef={interiorVideoRef}
                            exteriorVideoRef={exteriorVideoRef}
                            result={result}
                            activeSeek={activeSeek}
                          />
                        )}
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  </div>
                ) : (
                  /* Mobile Stacked View */
                  <div className="xl:hidden flex flex-col gap-6">
                    {/* Video Preview with Tab switch */}
                    <div ref={videoSectionRef} className="scroll-mt-4">
                      {activeMainTab === "damages" ? (
                        <div className="aspect-video w-full rounded-lg overflow-hidden bg-black shadow-sm mt-4">
                          <ImagePreviewPanel 
                            s3Uri={selectedDamage?.frame_s3_uri} 
                            signedUrl={selectedDamage?.frame_s3_uri_url}
                            regionName={result.regionName}
                            attributeName={selectedDamage?.value}
                          />
                        </div>
                      ) : (
                        <VideoPreviewTabs 
                          isMobile 
                          type={type} 
                          setType={setType}
                          interiorVideoRef={interiorVideoRef}
                          exteriorVideoRef={exteriorVideoRef}
                          result={result}
                          activeSeek={activeSeek}
                        />
                      )}
                    </div>
  
                    {/* Results / Photos Tabs for Mobile */}
                    <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
                      <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="results">Attributes</TabsTrigger>
                        <TabsTrigger value="damages">
                          Damages
                          {damageAttributes.length > 0 && (
                            <span className="ml-1.5 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">
                              {damageAttributes.length}
                            </span>
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="photos">
                          Photos
                          {(() => {
                            const aiImage = result.json.video?.image_s3_uri ? 1 : 0;
                            const extraPhotos = (result.json.evidencePhotos?.length || 0);
                            const photoCount = aiImage || extraPhotos ? Math.max(aiImage, extraPhotos) : 0;
                            return photoCount > 0 && (
                              <span className="ml-1.5 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">
                                {photoCount}
                              </span>
                            );
                          })()}
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="results">
                        <AttributesTable
                          attributes={standardAttributes}
                          onAttributeUpdate={(newAttr) => updateFeedback({ newAttribute: newAttr })}
                          onTimestampClick={handleTimestampClick}
                          onViewImage={handleViewImage}
                          onRowClick={(attr) => {
                            if (videoSectionRef.current) {
                              videoSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
                            }
                          }}
                          isCompact={isTableCompact}
                          imageS3Uri={result.json.video?.image_s3_uri_url || result.json.video?.image_s3_uri}
                        />
                      </TabsContent>

                      <TabsContent value="damages">
                        <AttributesTable
                          attributes={damageAttributes}
                          onAttributeUpdate={(newAttr) => updateFeedback({ newAttribute: newAttr })}
                          onTimestampClick={handleTimestampClick}
                          onViewImage={handleViewImage}
                          onRowClick={(attr) => {
                            setSelectedDamage(attr);
                            if (videoSectionRef.current) {
                              videoSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
                            }
                          }}
                          selectedAttribute={selectedDamage}
                          isCompact={isTableCompact}
                        />
                      </TabsContent>

                      <TabsContent value="photos">
                        {result.json.video?.image_s3_uri || (result.json.evidencePhotos && result.json.evidencePhotos.length > 0) ? (
                          <div className="grid grid-cols-1 gap-4 pb-6">
                            {result.json.video?.image_s3_uri ? (
                              <PhotoEvidenceItem 
                                key="mobile-main-image-evidence"
                                s3Uri={result.json.video.image_s3_uri} 
                                index={0} 
                                regionName={result.regionName} 
                              />
                            ) : (
                              result.json.evidencePhotos?.map((photo: any, idx) => (
                                <PhotoEvidenceItem 
                                  key={`mobile-photo-evidence-${idx}`} 
                                  s3Uri={typeof photo === 'string' ? photo : photo.original} 
                                  index={idx} 
                                  regionName={result.regionName} 
                                />
                              ))
                            )}
                          </div>
                        ) : (
                          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-muted-foreground border-2 border-dashed rounded-xl">
                            <ImageIcon className="h-8 w-8 opacity-20" />
                            <p className="text-sm">No photo evidence</p>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </div>
            )}
          </Tabs>
        </>
      )}
    </div>
  );
}
