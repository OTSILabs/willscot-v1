"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
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
import { PlusIcon, XIcon } from "lucide-react";
import { Row } from "@tanstack/react-table";

type FileToProcess = {
  file: File;
  index: number;
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
      maxFiles={10}
      accept="MP4"
      maxFileSize={100 * 1024 * 1024}
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

  const filesToProcess = useMemo(() => {
    return files.map((file, index) => ({ file, index }));
  }, [files]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      files: [],
    },
  });

  const columns = useMemo(() => {
    return [
      {
        header: "File Name",
        accessorKey: "file.name",
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
            // disabled={isPending}
          >
            <XIcon className="size-4" />
          </Button>
        ),
      },
    ];
  }, [handleDeleteFile]);

  return (
    <Form {...form}>
      <form onSubmit={() => {}}>
        <FileHiddenInput />
        {files.length > 0 ? (
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
                    onClick={() => {
                      handleClearFiles();
                      setRowSelection({});
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
                    disabled={files.length >= maxFiles}
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
                onRowSelectionChange={setRowSelection}
                rowSelection={rowSelection}
              />
            </CardContent>
          </Card>
        ) : (
          <FileInput />
        )}
      </form>
    </Form>
  );
}
