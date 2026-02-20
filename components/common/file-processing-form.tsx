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
      // Create a map of existing items by file name (assuming unique for now)
      const existingMap = new Map(prev.map((p) => [p.file.name, p]));

      return files.map((file, index) => {
        const existing = existingMap.get(file.name);
        if (existing) {
          return { ...existing, file, index }; // Update file reference and index
        }
        return {
          file,
          index,
          containerType: "trailer",
          model: "nova-2-pro",
          region: "us-west-2",
          jobType: "interior",
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

    setIsPending(true);
    const toastId = toast.loading("Uploading and processing videos...");

    try {
      const formData = new FormData();
      const configs = filesToProcess.map((item) => ({
        fileName: item.file.name,
        containerType: item.containerType,
        model: item.model,
        region: item.region,
        jobType: item.jobType,
      }));

      for (const item of filesToProcess) {
        formData.append("files", item.file);
      }
      formData.append("configs", JSON.stringify(configs));

      const response = await axios.post("/api/process-batch", formData);

      toast.success("All videos have been submitted successfully!", {
        id: toastId,
      });
      handleClearFiles();
      if (response.data?.id) {
        router.push(`/traces/${response.data.id}`);
      }
    } catch (error: any) {
      console.error("Submission error:", error);
      toast.error(error.response?.data?.error || "Failed to submit videos.", {
        id: toastId,
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

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit}>
        <FileHiddenInput />
        {files.length > 0 ? (
          <div className="space-y-4">
            <Card className="py-0 gap-0">
              <CardHeader className="border-b px-6 py-4! items-center">
                <CardTitle>Files to Process</CardTitle>
                <CardDescription>
                  Maximum of {maxFiles} files can be processed at a time.
                </CardDescription>
                <CardAction>
                  <ButtonGroup>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        handleClearFiles();
                        form.reset();
                      }}
                    >
                      <XIcon />
                      Clear all
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleOpenFileInput}
                      type="button"
                      disabled={files.length >= maxFiles || isPending}
                    >
                      <PlusIcon />
                      Add More
                    </Button>
                  </ButtonGroup>
                </CardAction>
              </CardHeader>
              <CardContent className="p-0">
                <DataTable
                  columns={columns}
                  data={filesToProcess}
                  enablePagination={false}
                />
              </CardContent>
              <CardFooter className={"border-t justify-end mb-4"}>
                <Button size="lg" type="submit" disabled={isPending}>
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
