"use client";

import { cn } from "@/lib/utils";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type DragEvent,
  type ChangeEvent,
  type ClipboardEvent,
} from "react";
import { toast } from "sonner";

import { UploadIcon } from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./ui/empty";
import { Button } from "./ui/button";

interface FileInputContextValue {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleOnDrag: (e: DragEvent<HTMLDivElement>) => void;
  handleOnDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: DragEvent<HTMLDivElement>) => void;
  handlePaste: (e: ClipboardEvent<HTMLDivElement>) => void;
  handleOpenFileInput: () => void;
  handleDeleteFile: (index: number | number[]) => void;
  addFiles: (userFiles: File[] | FileList) => void;
  handleClearFiles: () => void;
  isDragging: boolean;
  hasFiles: boolean;
  maxFiles: number;
  accept: string;
  multiple: boolean;
  maxFileSize: number;
  maxTotalSize: number;
  formatFileSize: (bytes: number) => string;
  totalSize: number;
  remainingSize: number;
}

const FileInputContext = createContext<FileInputContextValue | null>(null);

export const useFileInput = (): FileInputContextValue => {
  const context = useContext(FileInputContext);
  if (!context) {
    throw new Error("useFileInput must be used within a FileInputProvider");
  }
  return context;
};

interface FileInputProviderProps {
  children: ReactNode;
  maxFiles?: number;
  accept?: string;
  multiple?: boolean;
  maxFileSize?: number;
  maxTotalSize?: number;
}

export function FileInputProvider({
  children,
  maxFiles = 2,
  accept = "*",
  multiple = true,
  maxFileSize = 500 * 1024 * 1024,
  maxTotalSize = 500 * 1024 * 1024,
}: FileInputProviderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const setFileInputValue = useCallback((validFiles: File[]) => {
    const dataTransfer = new DataTransfer();
    validFiles.forEach((file) => dataTransfer.items.add(file));

    if (fileInputRef.current) {
      fileInputRef.current.files = dataTransfer.files;
    }
  }, []);

  const handleClearFiles = useCallback(() => {
    setFiles([]);
    setFileInputValue([]);
  }, [setFileInputValue]);

  const handleDeleteFile = useCallback(
    (index: number | number[]) => {
      const filteredFiles = files.filter((_, i) =>
        Array.isArray(index) ? !index.includes(i) : i !== index,
      );
      setFiles(filteredFiles);
      setFileInputValue(filteredFiles);
    },
    [files, setFileInputValue],
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
  };

  const handleSetFiles = useCallback(
    (userFiles: File[] | FileList = []) => {
      const filesState = [...files, ...Array.from(userFiles)];

      const invalidFiles: File[] = [];
      const oversizedFiles: File[] = [];
      let totalSize = 0;

      const validFiles = filesState.filter((file) => {
        const isValidType =
          accept === "*" ||
          (accept.endsWith("/*")
            ? file.type.startsWith(accept.replace("*", ""))
            : file.type.includes(accept));

        const isValidSize = file.size <= maxFileSize;

        if (!isValidType) invalidFiles.push(file);
        if (!isValidSize) oversizedFiles.push(file);

        if (isValidType && isValidSize) {
          totalSize += file.size;
        }

        return isValidType && isValidSize;
      });

      if (totalSize > maxTotalSize) {
        toast.error(
          `Total file size cannot exceed ${formatFileSize(
            maxTotalSize,
          )}. Current total: ${formatFileSize(totalSize)}`,
        );
        return;
      }

      if (invalidFiles.length) {
        toast.error(`You can only upload files with: ${accept}`);
      }

      if (oversizedFiles.length) {
        toast.error(`Some files exceed ${formatFileSize(maxFileSize)}`);
      }

      if (validFiles.length > maxFiles) {
        toast.error(`You can only upload ${maxFiles} files`);
      }

      const filteredFiles = validFiles.slice(0, maxFiles);
      setFiles(filteredFiles);
      setFileInputValue(filteredFiles);
    },
    [files, accept, maxFiles, maxFileSize, maxTotalSize, setFileInputValue],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleSetFiles(e.target.files);
      }
    },
    [handleSetFiles],
  );

  const handleOnDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleOnDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleSetFiles(e.dataTransfer.files);
    },
    [handleSetFiles],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const files = Array.from(e.clipboardData.items)
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter(Boolean) as File[];

      if (files.length) {
        handleSetFiles(files);
      }
    },
    [handleSetFiles],
  );

  const handleOpenFileInput = () => {
    fileInputRef.current?.click();
  };

  const totalSize = files.reduce((total, file) => total + file.size, 0);

  return (
    <FileInputContext.Provider
      value={{
        files,
        setFiles,
        handleChange,
        fileInputRef,
        handleOnDrag,
        handleOnDragLeave,
        isDragging,
        handleDrop,
        handlePaste,
        hasFiles: files.length > 0,
        handleDeleteFile,
        addFiles: handleSetFiles,
        handleClearFiles,
        maxFiles,
        handleOpenFileInput,
        accept,
        multiple,
        maxFileSize,
        maxTotalSize,
        formatFileSize,
        totalSize,
        remainingSize: maxTotalSize - totalSize,
      }}
    >
      {children}
    </FileInputContext.Provider>
  );
}

export function FileInput({ className, showInfo = true }: { className?: string; showInfo?: boolean }) {
  const {
    handleOnDrag,
    handleOnDragLeave,
    handleDrop,
    handlePaste,
    isDragging,
    maxFiles,
    handleOpenFileInput,
    accept,
    maxFileSize,
    maxTotalSize,
    formatFileSize,
  } = useFileInput();

  return (
    <div
      className={cn(
        "border-2 border-dashed bg-accent rounded-md transition-all",
        isDragging && "border-blue-500 bg-blue-50 dark:bg-blue-900/20",
        className,
      )}
      onDragOver={handleOnDrag}
      onDragLeave={handleOnDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      onClick={handleOpenFileInput}
    >
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UploadIcon
              className={cn(isDragging && "text-blue-500 animate-bounce")}
            />
          </EmptyMedia>
          <EmptyTitle>
            Drag and drop your files here or click to upload.
          </EmptyTitle>
          <EmptyDescription>
            {showInfo && (
              <>
                <div>
                  You can upload up to <b>{maxFiles}</b> files.
                </div>
                <div>
                  Allowed file types: <b className="font-mono bg-muted/50 px-1 rounded">{accept}</b>
                </div>
                <div>
                  Max file size: <b>{formatFileSize(maxFileSize)}</b>
                </div>
                <div>
                  Total upload limit: <b>{formatFileSize(maxTotalSize)}</b>
                </div>
              </>
            )}
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <Button variant="outline" type="button">
            Browse files
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}

type FileHiddenInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function FileHiddenInput({ className, ...props }: FileHiddenInputProps) {
  const { fileInputRef, handleChange, accept, multiple } = useFileInput();

  return (
    <input
      ref={fileInputRef}
      type="file"
      onChange={handleChange}
      multiple={multiple}
      accept={accept}
      className={cn("hidden", className)}
      {...props}
    />
  );
}
