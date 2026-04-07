"use client";

import { useEffect, useState, useMemo, useRef, ChangeEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";

import { ButtonGroup } from "../ui/button-group";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form } from "../ui/form";

import {
  FileHiddenInput,
  FileInputProvider,
  useFileInput,
} from "../file";
import { CameraIcon, PlayIcon, XIcon, UploadIcon, PlusIcon, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Input } from "../ui/input";
import { Spinner } from "../ui/spinner";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import axios from "axios";
import { VideoRecorder } from "./video-recorder";
import { ImageCapture } from "./image-capture";
import { humanizeString, humanizeFileSize } from "@/lib/utils";
import { Label } from "../ui/label";

type FileToProcess = {
  file: File;
  index: number;
  containerType: string;
  model: string;
  region: string;
  jobType: "interior" | "exterior";
};

const formSchema = z.object({
  files: z.array(z.instanceof(File)).min(1, {
    message: "Files are required.",
  }),
});

type FormValues = z.infer<typeof formSchema>;

export function FileProcessingForm() {
  return (
    <FileInputProvider
      maxFiles={2}
      accept="video/*"
      maxFileSize={500 * 1024 * 1024}
    >
      <FileProcessingFormContent />
    </FileInputProvider>
  );
}

export function FileProcessingFormContent() {
  const {
    files,
    handleDeleteFile,
    handleClearFiles,
    handleOpenFileInput,
    maxFiles,
    totalSize,
    remainingSize,
    isDragging,
    handleOnDrag,
    handleOnDragLeave,
    handleDrop,
    addFiles,
  } = useFileInput();

  const [filesToProcess, setFilesToProcess] = useState<FileToProcess[]>([]);
  const [recordingType, setRecordingType] = useState<"interior" | "exterior" | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<{ file: File; preview: string; qualityScore: number }[]>([]);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    setFilesToProcess((prev) => {
      const jobTypes = new Map<string, "interior" | "exterior">(
        prev.map((p) => [p.jobType, p.jobType]),
      );

      const existingMap = new Map(prev.map((p) => [p.file.name, p]));

      return files.map((file, index) => {
        const existing = existingMap.get(file.name);
        if (existing) {
          return { ...existing, file, index };
        }

        // Auto-assign job type based on what's missing
        let jobType: "interior" | "exterior" = "interior";
        if (jobTypes.get("interior")) {
          jobType = "exterior";
        } else if (jobTypes.get("exterior")) {
          jobType = "interior";
        }

        return {
          file,
          index,
          containerType: "trailer",
          model: "pegasus",
          region: "us-west-2",
          jobType: (index === 0 && !jobTypes.has("interior")) ? "interior" : (index === 1 && !jobTypes.has("exterior")) ? "exterior" : jobType,
        };
      });
    });
  }, [files]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      files: [],
    },
  });

  const processMutation = useMutation({
    mutationFn: async ({ filesToProcess, capturedPhotos }: { filesToProcess: FileToProcess[], capturedPhotos: { file: File }[] }) => {
      const toastId = toast.loading("Processing upload...", { closeButton: false });

      // Helper for Chunked Multipart Upload
      const uploadMultipart = async (
        file: File, 
        bucket: string, 
        key: string, 
        region: string, 
        contentType: string,
        onProgress: (percent: number) => void
      ) => {
        // 10MB chunks for files over 100MB, otherwise 5MB
        const CHUNK_SIZE = file.size > 100 * 1024 * 1024 ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
        const totalParts = Math.ceil(file.size / CHUNK_SIZE);
        
        let CONCURRENCY = 8;
        const nav = typeof navigator !== "undefined" ? (navigator as any) : null;
        if (nav?.connection) {
          const type = nav.connection.effectiveType;
          const isSlow = ["3g", "2g", "slow-2g"].includes(type) || nav.connection.saveData;
          if (isSlow) CONCURRENCY = 3;
        }
        
        let uploadId = "";
        try {
          const initRes = await axios.post("/api/s3/multipart", {
            action: "INITIATE", bucket, key, contentType, region,
          });
          uploadId = initRes.data.uploadId;

          const parts: { ETag: string; PartNumber: number }[] = [];
          const partProgress = new Map<number, number>();

          const updateProgress = () => {
            let totalLoaded = 0;
            partProgress.forEach((loaded) => { totalLoaded += loaded; });
            const percent = Math.round((totalLoaded * 100) / file.size);
            onProgress(Math.min(99, percent));
          };

          const presignRes = await axios.post("/api/s3/multipart", {
            action: "PRESIGN_PARTS", bucket, key, uploadId, partsCount: totalParts, region,
          });
          
          const allUrls = presignRes.data.urls;

          // Continuous Worker Pool Implementation
          let currentPartIndex = 0;
          const uploadPart = async (partInfo: { url: string; partNumber: number }) => {
            const start = (partInfo.partNumber - 1) * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);

            const res = await axios.put(partInfo.url, chunk, {
              onUploadProgress: (p) => {
                partProgress.set(partInfo.partNumber, p.loaded);
                updateProgress();
              }
            });

            const etag = res.headers.etag?.replace(/"/g, "") || "";
            return { ETag: etag, PartNumber: partInfo.partNumber };
          };

          const workers = Array.from({ length: Math.min(CONCURRENCY, totalParts) }).map(async () => {
            while (currentPartIndex < totalParts) {
              const index = currentPartIndex++;
              const partResult = await uploadPart(allUrls[index]);
              parts.push(partResult);
            }
          });

          await Promise.all(workers);

          const completeRes = await axios.post("/api/s3/multipart", {
            action: "COMPLETE", bucket, key, uploadId, parts, region,
          });

          return completeRes.data;
        } catch (error) {
          if (uploadId) {
            await axios.post("/api/s3/multipart", {
              action: "ABORT", bucket, key, uploadId, region,
            }).catch(console.error);
          }
          throw error;
        }
      };

      try {
        // 1. Upload Videos
        const uploadPromises = filesToProcess.map(async (item) => {
          const uploadToastId = toast.loading(`Uploading ${item.file.name}...`, {
            closeButton: false,
            id: `upload-${item.file.name}`
          });

          try {
            const region = item.region;
            let s3Uri = "";

            if (item.file.size > 5 * 1024 * 1024) {
              const multipartRes = await uploadMultipart(
                item.file,
                "ws-s3-unit-attribute-capture-nova",
                `${item.containerType.toUpperCase()}/${Date.now()}_${item.file.name.replace(/\s+/g, "_")}`,
                region,
                item.file.type,
                (percent) => {
                  toast.loading(
                    <div className="flex flex-col gap-2">
                      <div className="text-sm text-muted-foreground">Uploading (Accelerated Chunks)</div>
                      <div className="truncate max-w-md">{item.file.name}</div>
                      <div className="text-sm text-muted-foreground">{percent}%</div>
                    </div>,
                    { id: uploadToastId },
                  );
                }
              );
              s3Uri = multipartRes.s3Uri;
              toast.dismiss(uploadToastId);
            } else {
              const presignResponse = await axios.post("/api/s3/presign-upload", {
                fileName: item.file.name,
                containerType: item.containerType,
                region: item.region,
                contentType: item.file.type,
              });

              const { presignedUrl, s3Uri: generatedUri } = presignResponse.data;
              s3Uri = generatedUri;

              await axios.put(presignedUrl, item.file, {
                headers: { "Content-Type": item.file.type },
                onUploadProgress: (p) => {
                  if (p.total) {
                    const percent = Math.round((p.loaded * 100) / p.total);
                    toast.loading(
                      <div className="flex flex-col gap-2">
                        <div className="text-sm text-muted-foreground">Uploading</div>
                        <div className="truncate max-w-md">{item.file.name}</div>
                        <div className="text-sm text-muted-foreground">{percent}%</div>
                      </div>,
                      { id: uploadToastId },
                    );
                  }
                },
              });
              toast.dismiss(uploadToastId);
            }

            return {
              s3Uri,
              fileName: item.file.name,
              containerType: item.containerType,
              model: item.model,
              region: item.region,
              jobType: item.jobType,
            };
          } catch (error) {
            toast.dismiss(uploadToastId);
            throw error;
          }
        });

        const uploadResults = await Promise.all(uploadPromises);

        // 2. Upload Captured Photos
        let photoUris: string[] = [];
        if (capturedPhotos.length > 0) {
          const photoUploadPromises = capturedPhotos.map(async (photo, idx) => {
            const photoToastId = `photo-upload-${idx}`;
            toast.loading(`Uploading Photo Evidence ${idx + 1}...`, { id: photoToastId });
            
            try {
              const res = await axios.post("/api/s3/presign-upload", {
                fileName: photo.file.name,
                containerType: "EVIDENCE",
                region: "us-west-2",
                contentType: photo.file.type,
              });

              await axios.put(res.data.presignedUrl, photo.file, {
                headers: { "Content-Type": photo.file.type }
              });
              
              toast.dismiss(photoToastId);
              return res.data.s3Uri;
            } catch (err) {
              toast.dismiss(photoToastId);
              throw err;
            }
          });
          photoUris = await Promise.all(photoUploadPromises);
        }

        // 3. Process Batch
        const response = await axios.post("/api/process-batch", {
          jobs: uploadResults,
          evidencePhotos: photoUris,
        });

        return { id: response.data.id, toastId };
      } catch (error) {
        toast.dismiss(toastId);
        throw error;
      }
    },
    onSuccess: (data: { id: string; toastId: string }) => {
      toast.success("Batch successfully submitted!", { id: data.toastId });
      if (data.id) router.push(`/traces/${data.id}`);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error || error.message || "Submission failed";
      toast.error(`Failed to submit videos: ${errorMessage}`);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (filesToProcess.length === 0) {
      toast.error("Please select at least one file.");
      return;
    }

    const exteriorJobs = filesToProcess.filter(f => f.jobType === "exterior").length;
    const interiorJobs = filesToProcess.filter(f => f.jobType === "interior").length;

    if (!interiorJobs || !exteriorJobs) {
      toast.error("Invalid job type selection.", {
        description: "Please select at least one interior and one exterior job.",
      });
      return;
    }

    processMutation.mutate({ filesToProcess, capturedPhotos });
  };

  const handleDeletePhoto = (idx: number) => {
    setCapturedPhotos(prev => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx].preview);
      next.splice(idx, 1);
      return next;
    });
  };
  
  const handleOpenImageInput = () => {
    imageInputRef.current?.click();
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = 3 - capturedPhotos.length;
    const filesToAdd = files.slice(0, remaining);

    const newPhotos = filesToAdd.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      qualityScore: 100 // Default quality score for uploaded photos
    }));

    setCapturedPhotos(prev => [...prev, ...newPhotos]);
    toast.success(`${filesToAdd.length} photo(s) added successfully.`);
    if (e.target) e.target.value = "";
  };

  const totalPhotosSize = useMemo(() => {
    return capturedPhotos.reduce((sum, photo) => sum + photo.file.size, 0);
  }, [capturedPhotos]);

  const combinedTotalSize = totalSize + totalPhotosSize;

  const interiorFile = filesToProcess.find((f) => f.jobType === "interior");
  const exteriorFile = filesToProcess.find((f) => f.jobType === "exterior");
  const hasBoth = interiorFile && exteriorFile && capturedPhotos.length >= 1;

  const renderUploadCard = (title: string, expectedJobType: "interior" | "exterior", fileObj: FileToProcess | undefined) => (
    <div className="border rounded-xl p-4 bg-muted/20 flex flex-col gap-3">
      <h3 className="font-semibold text-sm uppercase tracking-wider">{title}</h3>
      {fileObj ? (
        <div className="flex flex-col gap-3">
          <div className="text-xs font-mono truncate bg-background p-2 rounded border border-border/50">
            {fileObj.file.name}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider w-max">Region</span>
              <Input
                value={fileObj.region}
                disabled
                className="h-9 text-xs bg-muted/50 font-medium border-border"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider w-max">Container Type</span>
              <Select
                value={fileObj.containerType}
                onValueChange={(val) => {
                  setFilesToProcess((prev) =>
                    prev.map((f) => (f.index === fileObj.index ? { ...f, containerType: val } : f))
                  );
                }}
              >
                <SelectTrigger className="h-9 text-xs border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trailer">Trailer</SelectItem>
                  <SelectItem value="container">Container</SelectItem>
                  <SelectItem value="flex">Flex</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider w-max">Model</span>
              <Input
                value={humanizeString(fileObj.model)}
                disabled
                className="h-9 text-xs bg-muted/50 font-medium border-border"
              />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <Button
              variant="destructive"
              size="sm"
              className="h-8 shadow-sm"
              onClick={() => handleDeleteFile(fileObj.index)}
              disabled={processMutation.isPending}
            >
              <XIcon className="w-4 h-4 mr-1" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div 
          className={cn(
            "flex flex-col lg:flex-row gap-4 h-full min-h-[160px] p-4 bg-background/50 border-2 border-dashed rounded-lg transition-all items-center justify-center relative group",
            isDragging && "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
          )}
          onDragOver={handleOnDrag}
          onDragLeave={handleOnDragLeave}
          onDrop={handleDrop}
        >
          {isDragging && (
             <div className="absolute inset-0 z-10 hidden lg:flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg border-2 border-blue-500 pointer-events-none">
               <span className="font-semibold text-blue-500 flex items-center gap-2 text-center">
                 <UploadIcon className="w-5 h-5 animate-bounce" />
                 Drop video here
               </span>
             </div>
          )}
          <Button
            variant="outline"
            className="w-full flex-1 min-h-[80px] lg:h-32 text-muted-foreground hover:text-foreground hover:bg-muted/50 shadow-sm flex flex-col gap-2 items-center justify-center p-3 relative transition-all"
            onClick={handleOpenFileInput}
            disabled={processMutation.isPending || files.length >= maxFiles}
            type="button"
          >
            <UploadIcon className="w-6 h-6 lg:w-8 lg:h-8 mb-0 lg:mb-1 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-tight text-center">Import from Device</span>
            <span className="text-[10px] hidden lg:block opacity-50 text-center">drag and drop video here</span>
          </Button>
          <Button
            variant="outline"
            className="w-full flex-1 min-h-[80px] lg:h-32 text-muted-foreground hover:text-foreground hover:bg-muted/50 shadow-sm flex flex-col gap-2 items-center justify-center p-3 transition-all"
            onClick={() => setRecordingType(expectedJobType)}
            disabled={processMutation.isPending || files.length >= maxFiles}
            type="button"
          >
            <CameraIcon className="w-6 h-6 lg:w-8 lg:h-8 mb-0 lg:mb-1 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-tight text-center">Record Video</span>
            <span className="text-[10px] hidden lg:block opacity-50 text-center">Capture live video from camera</span>
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit}>
        <FileHiddenInput />

        <div className="block">
          <div className="space-y-4">
            <Card className="py-0 gap-0 border-none shadow-none bg-transparent xl:border xl:shadow-sm xl:bg-card">
              <CardHeader className="border-none px-0 py-4 items-center xl:border-b xl:px-6">
                <CardTitle className="xl:block hidden">Files to Process</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-1 space-y-1 block max-w-sm">
                  <p>You can upload up to 2 files.</p>
                  <p>Allowed file types: <span className="font-mono bg-muted/50 px-1 rounded">video/*</span></p>
                  <p>Max file size: 500.00 MB</p>
                  <p>Total upload limit: 500.00 MB</p>
                  {combinedTotalSize > 0 && (
                    <div className="mt-3 p-2 bg-muted/30 rounded-md border border-border/50 text-foreground flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Current total:</span>
                        <span className="font-normal xl:font-bold font-mono text-xs xl:text-sm">{humanizeFileSize(combinedTotalSize)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Remaining limit:</span>
                        <span className="font-normal xl:font-bold font-mono text-xs xl:text-sm text-blue-600 dark:text-blue-400">{humanizeFileSize(remainingSize - totalPhotosSize)}</span>
                      </div>
                    </div>
                  )}
                </CardDescription>
                <CardAction className="w-full xl:w-auto mt-2 xl:mt-0">
                  <ButtonGroup className="w-full xl:w-auto justify-between xl:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      disabled={processMutation.isPending || (files.length === 0 && capturedPhotos.length === 0)}
                      className={cn("flex-1 xl:flex-none", (files.length === 0 && capturedPhotos.length === 0) && "opacity-50 pointer-events-none")}
                      onClick={() => {
                        handleClearFiles();
                        capturedPhotos.forEach(p => URL.revokeObjectURL(p.preview));
                        setCapturedPhotos([]);
                        form.reset();
                        toast.success("All files and evidence cleared.");
                      }}
                    >
                      <XIcon className="mr-1 h-4 w-4" />
                      Clear all
                    </Button>
                  </ButtonGroup>
                </CardAction>
              </CardHeader>
              <CardContent className="p-0 px-0 xl:px-6">
                <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6 xl:gap-8 py-4 px-0 xl:py-8">
                  {renderUploadCard("Interior Video", "interior", interiorFile)}
                  {renderUploadCard("Exterior Video", "exterior", exteriorFile)}
                  
                  {/* PHOTO EVIDENCE CARD */}
                  <div className="border rounded-xl p-4 bg-muted/20 flex flex-col gap-3 min-h-[160px]">
                    <div className="flex items-center justify-between">
                       <h3 className="font-semibold text-sm uppercase tracking-wider">Photo Evidence</h3>
                       {capturedPhotos.length > 0 && (
                        <div className="text-[10px] font-mono text-muted-foreground bg-background px-2 py-0.5 rounded border border-border/50">
                          {humanizeFileSize(totalPhotosSize)}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 bg-background/50 p-2 rounded-lg border border-border/50">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                          <CameraIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className={`text-[10px] uppercase font-bold tracking-tight ${capturedPhotos.length > 0 ? "text-primary" : "text-muted-foreground"}`}>
                            {capturedPhotos.length === 0 ? "Required Min 1 Max 3" : `${capturedPhotos.length} / 3 Captured`}
                          </p>
                        </div>
                    </div>
 
                    <div className="flex-1 flex flex-col gap-3 relative">
                      <input 
                        type="file" 
                        ref={imageInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        multiple 
                        onChange={handleImageUpload} 
                      />
 
                      {capturedPhotos.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2 bg-background/50 p-2 rounded-lg border border-dashed border-primary/20 min-h-[100px]">
                          {capturedPhotos.map((photo, idx) => (
                            <div key={idx} className="relative aspect-square rounded-md overflow-hidden border group shadow-sm bg-muted/20">
                              <img src={photo.preview} className="w-full h-full object-cover" alt="Evidence" />
                              <div className={`absolute top-0 right-0 w-3 h-3 rounded-bl-md z-10 ${
                                photo.qualityScore >= 80 ? 'bg-emerald-500' : photo.qualityScore >= 50 ? 'bg-amber-500' : 'bg-red-500'
                              }`} title={`Quality: ${photo.qualityScore}%`} />
                              <button
                                type="button"
                                onClick={() => handleDeletePhoto(idx)}
                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                              >
                                <XIcon className="w-4 h-4 text-white" />
                              </button>
                            </div>
                          ))}
                          
                          {capturedPhotos.length < 3 && (
                            <button
                              type="button"
                              onClick={() => setIsCapturingPhoto(true)}
                              className="aspect-square rounded-md border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 hover:border-primary/50 hover:text-primary transition-all gap-1"
                            >
                              <CameraIcon className="w-4 h-4" />
                              <span className="text-[8px] font-bold uppercase">Capture</span>
                            </button>
                          )}
                          {capturedPhotos.length < 3 && (
                            <button
                              type="button"
                              onClick={handleOpenImageInput}
                              className="aspect-square rounded-md border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 hover:border-primary/50 hover:text-primary transition-all gap-1"
                            >
                              <PlusIcon className="w-4 h-4" />
                              <span className="text-[8px] font-bold uppercase">Add</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col lg:flex-row gap-4 h-full min-h-[160px] p-4 bg-background/50 border-2 border-dashed rounded-lg transition-all items-center justify-center relative group">
                          <Button
                            variant="outline"
                            className="w-full flex-1 min-h-[80px] lg:h-32 text-muted-foreground hover:text-foreground hover:bg-muted/50 shadow-sm flex flex-col gap-2 items-center justify-center p-3 relative transition-all"
                            onClick={handleOpenImageInput}
                            disabled={processMutation.isPending}
                            type="button"
                          >
                            <UploadIcon className="w-6 h-6 lg:w-8 lg:h-8 mb-0 lg:mb-1 shrink-0" />
                            <span className="text-xs sm:text-sm font-semibold uppercase tracking-tight text-center">Import from Device</span>
                            <span className="text-[10px] hidden lg:block opacity-50 text-center">Select photo evidence</span>
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full flex-1 min-h-[80px] lg:h-32 text-muted-foreground hover:text-foreground hover:bg-muted/50 shadow-sm flex flex-col gap-2 items-center justify-center p-3 transition-all"
                            onClick={() => setIsCapturingPhoto(true)}
                            disabled={processMutation.isPending}
                            type="button"
                          >
                            <CameraIcon className="w-6 h-6 lg:w-8 lg:h-8 mb-0 lg:mb-1 shrink-0" />
                            <span className="text-xs sm:text-sm font-semibold uppercase tracking-tight text-center">Capture Photo</span>
                            <span className="text-[10px] hidden lg:block opacity-50 text-center">Capture live high-quality evidence</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className={cn("border-none px-0 pt-4 xl:border-t xl:px-6 mb-4 justify-end", !hasBoth && "hidden")}>
                <Button size="lg" type="submit" disabled={processMutation.isPending || !hasBoth} className="w-full xl:w-auto shadow-sm">
                  {processMutation.isPending ? (
                    <>
                      Processing Videos...
                      <Spinner className="ml-2" />
                    </>
                  ) : (
                    <>
                      Start Process Now
                      <PlayIcon className="ml-2" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </form>

      <VideoRecorder
        isOpen={!!recordingType}
        title={`Record ${recordingType === "interior" ? "Interior" : "Exterior"} Video`}
        onClose={() => setRecordingType(null)}
        onCapture={(file) => {
          addFiles([file]);
          toast.success("Live video captured and added!");
        }}
      />

      <ImageCapture 
        isOpen={isCapturingPhoto}
        onClose={() => setIsCapturingPhoto(false)}
        initialCount={capturedPhotos.length}
        onCapture={(photos) => {
          setCapturedPhotos(prev => [...prev, ...photos].slice(0, 3));
          toast.success("Shelf/Unit photos captured successfully.");
        }}
      />
    </Form>
  );
}
