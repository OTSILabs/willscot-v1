"use client";

import { useState, type ReactNode } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

interface CopyToClipboardProps {
  value: string | number | ReactNode;
  className?: string;
  isLoading?: boolean;
  iconSize?: string;
}

export function CopyToClipboard({
  value,
  className,
  isLoading = false,
  iconSize = "size-4",
}: CopyToClipboardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    try {
      const valueToCopy =
        typeof value === "string" || typeof value === "number"
          ? value.toString()
          : (
              value as { props?: { value?: unknown } }
            )?.props?.value?.toString();

      if (!valueToCopy) throw new Error("Nothing to copy");

      await navigator.clipboard.writeText(valueToCopy);
      setCopied(true);
      toast.success("Copied to clipboard");

      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  if (isLoading || !value) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className={cn("p-0", className, iconSize)}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className={cn("text-green-600", iconSize)} />
      ) : (
        <Copy className={cn(iconSize)} />
      )}
    </Button>
  );
}
