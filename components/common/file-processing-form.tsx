"use client";

import { useEffect, useMemo, useState } from "react";
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
  FileInput,
  FileInputProvider,
  useFileInput,
} from "../file";
import { CameraIcon, PlayIcon, PlusIcon, XIcon, UploadIcon } from "lucide-react";
import { Row } from "@tanstack/react-table";
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
import { humanizeString, humanizeFileSize } from "@/lib/utils";

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
  const [isPending, setIsPending] = useState(false);
  const [recordingType, setRecordingType] = useState<"interior" | "exterior" | null>(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (filesToProcess.length === 0) {
      toast.error("Please select at least one file.");
      return;
    }

    let exteriorJobs = filesToProcess.filter(f => f.jobType === "exterior").length;
    let interiorJobs = filesToProcess.filter(f => f.jobType === "interior").length;

    if (!interiorJobs || !exteriorJobs) {
      toast.error("Invalid job type selection.", {
        description: "Please select at least one interior and one exterior job.",
      });
      return;
    }

    setIsPending(true);
    const toastId = toast.loading("Uploading videos to S3...", {
      closeButton: false
    });

    try {
      const uploadPromises = filesToProcess.map(async (item) => {
        const uploadToastId = toast.loading(`Uploading ${item.file.name}...`, {
          closeButton: false,
          id: `upload-${item.file.name}`
        });

        try {
          const presignResponse = await axios.post("/api/s3/presign-upload", {
            fileName: item.file.name,
            containerType: item.containerType,
            region: item.region,
            contentType: item.file.type,
          });

          const { presignedUrl, s3Uri } = presignResponse.data;

          await axios.put(presignedUrl, item.file, {
            headers: {
              "Content-Type": item.file.type,
            },
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const percentCompleted = Math.round(
                  (progressEvent.loaded * 100) / progressEvent.total,
                );
                toast.loading(
                  <div className="flex flex-col gap-2">
                    <div className="text-sm text-muted-foreground">Uploading</div>
                    <div className="truncate max-w-md">{item.file.name}</div>
                    <div className="text-sm text-muted-foreground">{percentCompleted}%</div>
                  </div>,
                  { id: uploadToastId },
                );

                if (percentCompleted === 100) {
                  toast.dismiss(uploadToastId);
                }
              }
            },
          });

          return {
            s3Uri,
            fileName: item.file.name,
            containerType: item.containerType,
            model: item.model,
            region: item.region,
            jobType: item.jobType,
          };
        } catch (error) {
          const individualError = (error && typeof error === "object" && "response" in error
            ? (error.response as { data?: { error?: string } })?.data?.error
            : null) || (error instanceof Error ? error.message : "Upload failed");
          
          toast.error(`Upload failed for ${item.file.name}: ${individualError}`, {
            id: uploadToastId,
            closeButton: true
          });
          throw error;
        }
      });

      const results = await Promise.allSettled(uploadPromises);
      
      const failedJobs = results.filter(r => r.status === 'rejected');
      const successfulJobs = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value);

      if (failedJobs.length > 0) {
        toast.error(`${failedJobs.length} video(s) failed to upload. Please try again.`, {
          id: toastId,
          closeButton: true
        });
        return;
      }

      const response = await axios.post("/api/process-batch", {
        jobs: successfulJobs,
      });

      toast.success("All videos have been submitted successfully!", {
        id: toastId,
      });

      if (response.data?.id) {
        router.push(`/traces/${response.data.id}`);
      }

    } catch (error: unknown) {
      const errorMessage =
        (error && typeof error === "object" && "response" in error
          ? (error.response as { data?: { error?: string } })?.data?.error
          : null) ||
        (error instanceof Error ? error.message : "Unknown error");
      
      toast.error(`Failed to submit videos: ${errorMessage}`, {
        id: toastId,
        closeButton: true
      });

    } finally {
      setIsPending(false);
    }
  };

  const interiorFile = filesToProcess.find((f) => f.jobType === "interior");
  const exteriorFile = filesToProcess.find((f) => f.jobType === "exterior");
  const hasBoth = interiorFile && exteriorFile;

  const renderUploadCard = (title: string, expectedJobType: "interior" | "exterior", fileObj: FileToProcess | undefined) => (
    <div className="border rounded-xl p-4 bg-muted/20 flex flex-col gap-3">
      <h3 className="font-semibold text-sm uppercase tracking-wider">{title}</h3>
      {fileObj ? (
        <div className="flex flex-col gap-3">
          <div className="text-xs font-mono truncate bg-background p-2 rounded border border-border/50">
            {fileObj.file.name}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-normal text-muted-foreground tracking-wider w-max">Region</span>
              <Input
                value={fileObj.region}
                disabled
                className="h-9 text-xs bg-muted/50 font-medium"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-normal text-muted-foreground tracking-wider w-max">Container Type</span>
              <Select
                value={fileObj.containerType}
                onValueChange={(val) => {
                  setFilesToProcess((prev) =>
                    prev.map((f) => (f.index === fileObj.index ? { ...f, containerType: val } : f))
                  );
                }}
              >
                <SelectTrigger className="h-9 text-xs">
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
              <span className="text-[10px] uppercase font-normal text-muted-foreground tracking-wider w-max">Model</span>
              <Input
                value={humanizeString(fileObj.model)}
                disabled
                className="h-9 text-xs bg-muted/50 font-medium"
              />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <Button
              variant="destructive"
              size="sm"
              className="h-8 shadow-sm"
              onClick={() => handleDeleteFile(fileObj.index)}
              disabled={isPending}
            >
              <XIcon className="w-4 h-4 mr-1" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div 
          className={cn(
            "flex flex-col md:flex-row gap-3 h-full min-h-[160px] p-4 bg-background/50 border-2 border-dashed rounded-lg transition-all items-center justify-center relative group",
            isDragging && "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
          )}
          onDragOver={handleOnDrag}
          onDragLeave={handleOnDragLeave}
          onDrop={handleDrop}
        >
          {isDragging && (
             <div className="absolute inset-0 z-10 hidden md:flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg border-2 border-blue-500 pointer-events-none">
               <span className="font-semibold text-blue-500 flex items-center gap-2">
                 <UploadIcon className="w-5 h-5 animate-bounce" />
                 Drop video here
               </span>
             </div>
          )}
          <Button
            variant="outline"
            className="w-full flex-1 h-20 md:h-32 text-muted-foreground hover:text-foreground hover:bg-muted/50 shadow-sm flex flex-col gap-2 items-center justify-center p-3 relative transition-all"
            onClick={handleOpenFileInput}
            disabled={isPending || files.length >= maxFiles}
            type="button"
          >
            <UploadIcon className="w-6 h-6 md:w-8 md:h-8 mb-0 md:mb-1" />
            <span className="text-sm font-normal md:font-semibold uppercase tracking-tight">Import from Device</span>
            <span className="text-xs hidden md:block opacity-50">or drag and drop video here</span>
          </Button>
          <Button
            variant="outline"
            className="w-full flex-1 h-20 md:hidden text-muted-foreground hover:text-foreground hover:bg-muted/50 shadow-sm flex flex-col gap-2 items-center justify-center p-3"
            onClick={() => setRecordingType(expectedJobType)}
            disabled={isPending || files.length >= maxFiles}
            type="button"
          >
            <CameraIcon className="w-6 h-6 mb-0" />
            <span className="text-sm font-normal uppercase tracking-tight">Record Video</span>
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
            <Card className="py-0 gap-0 border-none shadow-none bg-transparent md:border md:shadow-sm md:bg-card">
              <CardHeader className="border-none px-0 py-4 items-center md:border-b md:px-6">
                <CardTitle className="md:block hidden">Files to Process</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-1 space-y-1 block max-w-sm">
                  <p>You can upload up to 2 files.</p>
                  <p>Allowed file types: <span className="font-mono bg-muted/50 px-1 rounded">video/*</span></p>
                  <p>Max file size: 500.00 MB</p>
                  <p>Total upload limit: 500.00 MB</p>
                  {totalSize > 0 && (
                    <div className="mt-3 p-2 bg-muted/30 rounded-md border border-border/50 text-foreground flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Current total:</span>
                        <span className="font-normal md:font-bold font-mono text-xs md:text-sm">{humanizeFileSize(totalSize)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Remaining limit:</span>
                        <span className="font-normal md:font-bold font-mono text-xs md:text-sm text-blue-600 dark:text-blue-400">{humanizeFileSize(remainingSize)}</span>
                      </div>
                    </div>
                  )}
                </CardDescription>
                <CardAction className="w-full md:w-auto mt-2 md:mt-0">
                  <ButtonGroup className="w-full md:w-auto justify-between md:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      disabled={isPending || files.length === 0}
                      className={cn("flex-1 md:flex-none", files.length === 0 && "opacity-50 pointer-events-none")}
                      onClick={() => {
                        handleClearFiles();
                        form.reset();
                      }}
                    >
                      <XIcon className="mr-1 h-4 w-4" />
                      Clear all
                    </Button>
                  </ButtonGroup>
                </CardAction>
              </CardHeader>
              <CardContent className="p-0 px-0 md:px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 py-4 px-0 md:py-6">
                  {renderUploadCard("Interior Video", "interior", interiorFile)}
                  {renderUploadCard("Exterior Video", "exterior", exteriorFile)}
                </div>
              </CardContent>
              <CardFooter className={cn("border-none px-0 pt-4 md:border-t md:px-6 mb-4 justify-end", !hasBoth && "hidden")}>
                <Button size="lg" type="submit" disabled={isPending || !hasBoth} className="w-full md:w-auto shadow-sm">
                  {isPending ? (
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
    </Form>
  );
}
