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
import { DataTable } from "../data-table";
import { PlayIcon, PlusIcon, XIcon } from "lucide-react";
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
  } = useFileInput();

  const [filesToProcess, setFilesToProcess] = useState<FileToProcess[]>([]);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setFilesToProcess((prev) => {
      const jobType = new Map<string, "interior" | "exterior">(
        prev.map((p) => [p.jobType, p.jobType]),
      );


      const existingMap = new Map(prev.map((p) => [p.file.name, p]));

      return files.map((file, index) => {
        const existing = existingMap.get(file.name);
        if (existing) {
          return { ...existing, file, index };
        }

        return {
          file,
          index,
          containerType: "trailer",
          model: "nova-2-omni",
          region: "us-west-2",
          jobType: jobType.get("interior") ? "exterior" : "interior",
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

    let exteriorJobs = 0;
    let interiorJobs = 0;

    for (const item of filesToProcess) {
      if (item.jobType === "exterior") {
        exteriorJobs++;
      } else {
        interiorJobs++;
      }
    }

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

      filesToProcess.forEach((item) => {
        toast.dismiss(`upload-${item.file.name}`);
      });

    } finally {
      setIsPending(false);
    }
  };

  const columns = useMemo(() => {
    return [
      {
        header: "File Name",
        accessorKey: "file.name",
      },
      {
        header: "Container Type",
        accessorKey: "containerType",
        cell: ({ row }: { row: Row<FileToProcess> }) => (
          <Select
            value={row.original.containerType}
            onValueChange={(value) => {
              setFilesToProcess((prev) =>
                prev.map((file) =>
                  file.index === row.index
                    ? { ...file, containerType: value }
                    : file,
                ),
              );
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select container type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trailer">Trailer</SelectItem>
              <SelectItem value="container">Container</SelectItem>
              <SelectItem value="flex">Flex</SelectItem>
            </SelectContent>
          </Select>
        ),
      },
      {
        header: "Job Type",
        accessorKey: "jobType",
        cell: ({ row }: { row: Row<FileToProcess> }) => (
          <Select
            value={row.original.jobType}
            onValueChange={(value: "interior" | "exterior") => {
              setFilesToProcess((prev) =>
                prev.map((file) =>
                  file.index === row.index ? { ...file, jobType: value } : file,
                ),
              );
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="interior">Interior</SelectItem>
              <SelectItem value="exterior">Exterior</SelectItem>
            </SelectContent>
          </Select>
        ),
      },
      {
        header: "Model",
        accessorKey: "model",
        cell: ({ row }: { row: Row<FileToProcess> }) => (
          <Select
            value={row.original.model}
            onValueChange={(value) => {
              setFilesToProcess((prev) =>
                prev.map((file) =>
                  file.index === row.index ? { ...file, model: value } : file,
                ),
              );
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nova-2-omni">Nova 2 Omni</SelectItem>
              <SelectItem value="nova-2-pro">Nova 2 Pro</SelectItem>
              <SelectItem value="nova-2-lite">Nova 2 Lite</SelectItem>
            </SelectContent>
          </Select>
        ),
      },
      {
        header: "Region",
        accessorKey: "region",
        cell: ({ row }: { row: Row<FileToProcess> }) => (
          <Input value={row.original.region} disabled />
        ),
      },
      {
        header: "Action",
        accessorKey: "action",
        rowClassName: "w-10 text-center",
        enableHiding: false,
        cell: ({ row }: { row: Row<FileToProcess> }) => (
          <Button
            size="sm"
            className="size-6 cursor-pointer"
            onClick={() => handleDeleteFile(row.index)}
            variant="destructive"
            type="button"
            disabled={isPending}
          >
            <XIcon className="size-4" />
          </Button>
        ),
      },
    ];
  }, [handleDeleteFile, isPending]);

  const interiorFile = filesToProcess.find((f) => f.jobType === "interior");
  const exteriorFile = filesToProcess.find((f) => f.jobType === "exterior");
  const hasBoth = interiorFile && exteriorFile;

  const renderMobileCard = (title: string, expectedJobType: "interior" | "exterior", fileObj: FileToProcess | undefined) => (
    <div className="border rounded-xl p-4 bg-muted/20 flex flex-col gap-3">
      <h3 className="font-semibold text-sm uppercase tracking-wider">{title}</h3>
      {fileObj ? (
        <div className="flex flex-col gap-3">
          <div className="text-xs font-mono truncate bg-background p-2 rounded border border-border/50">
            {fileObj.file.name}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground w-max">Region</span>
              <Input
                value={fileObj.region}
                disabled
                className="h-9 text-xs bg-muted/50 font-medium"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground w-max">Job Type</span>
              <Input
                value={expectedJobType.charAt(0).toUpperCase() + expectedJobType.slice(1)}
                disabled
                className="h-9 text-xs bg-muted/50 font-medium"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground w-max">Container Type</span>
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
              <span className="text-[10px] uppercase font-bold text-muted-foreground w-max">Model</span>
              <Select
                value={fileObj.model}
                onValueChange={(val) => {
                  setFilesToProcess((prev) =>
                    prev.map((f) => (f.index === fileObj.index ? { ...f, model: val } : f))
                  );
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nova-2-omni">Nova 2 Omni</SelectItem>
                  <SelectItem value="nova-2-pro">Nova 2 Pro</SelectItem>
                  <SelectItem value="nova-2-lite">Nova 2 Lite</SelectItem>
                </SelectContent>
              </Select>
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
        <Button
          variant="outline"
          className="w-full border-dashed h-12 text-muted-foreground hover:text-foreground bg-background/50 shadow-sm"
          onClick={handleOpenFileInput}
          disabled={isPending || files.length >= maxFiles}
          type="button"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Upload {title}
        </Button>
      )}
    </div>
  );

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit}>
        <FileHiddenInput />
        {files.length > 0 ? (
          <div className="space-y-4">
            <Card className="py-0 gap-0 border-none shadow-none bg-transparent md:border md:shadow-sm md:bg-card">
              <CardHeader className="border-none px-0 py-4! items-center md:border-b md:px-6">
                <CardTitle className="md:block hidden">Files to Process</CardTitle>
                <CardDescription className="md:block hidden">
                  Maximum of {maxFiles} files can be processed at a time.
                </CardDescription>
                <CardAction className="w-full md:w-auto">
                  <ButtonGroup className="w-full md:w-auto justify-between md:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      disabled={isPending}
                      className="flex-1 md:flex-none"
                      onClick={() => {
                        handleClearFiles();
                        form.reset();
                      }}
                    >
                      <XIcon className="mr-1 h-4 w-4" />
                      Clear all
                    </Button>
                    <Button
                      size="sm"
                      className="hidden md:flex"
                      onClick={handleOpenFileInput}
                      type="button"
                      disabled={files.length >= maxFiles || isPending}
                    >
                      <PlusIcon className="mr-1 h-4 w-4" />
                      Add More
                    </Button>
                  </ButtonGroup>
                </CardAction>
              </CardHeader>
              <CardContent className="p-0">
                <div className="hidden md:block">
                  <DataTable
                    columns={columns}
                    data={filesToProcess}
                    enablePagination={false}
                  />
                </div>
                <div className="md:hidden flex flex-col gap-4 py-4">
                  {renderMobileCard("Interior Video", "interior", interiorFile)}
                  {renderMobileCard("Exterior Video", "exterior", exteriorFile)}
                </div>
              </CardContent>
              <CardFooter className={cn("border-none px-0 pt-4 md:border-t md:px-6 mb-4 justify-end", !hasBoth && "hidden md:flex")}>
                <Button size="lg" type="submit" disabled={isPending || (!hasBoth && filesToProcess.length > 0)} className="w-full md:w-auto shadow-sm">
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
        ) : (
          <FileInput />
        )}
      </form>
    </Form>
  );
}
