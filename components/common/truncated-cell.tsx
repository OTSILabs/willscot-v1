import { cn } from "@/lib/utils";

interface TruncatedCellProps {
  content: string | number | null | undefined;
  className?: string;
  maxW?: string;
}

/**
 * A reusable table cell component that handles text truncation 
 * with a native browser tooltip on hover.
 */
export function TruncatedCell({ 
  content, 
  className, 
  maxW = "max-w-[150px] md:max-w-[200px]" 
}: TruncatedCellProps) {
  const displayValue = content?.toString() || "";
  
  return (
    <div 
      className={cn("truncate", maxW, className)} 
      title={displayValue}
    >
      {displayValue}
    </div>
  );
}
