import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CopyToClipboard } from "./copy-to-clipboard";
import { Skeleton } from "./ui/skeleton";


interface PageTitleProps {
  title: ReactNode;
  className?: string;
}

export function PageTitle({ title, className }: PageTitleProps) {
  return <h1 className={cn("text-xl md:text-2xl font-bold tracking-tight", className)}>{title}</h1>;
}

interface PageDescriptionProps {
  description: ReactNode;
  className?: string;
}

export function PageDescription({ description, className }: PageDescriptionProps) {
  return (
    <p className={cn("text-sm md:text-sm text-muted-foreground", className)}>{description}</p>
  );
}

interface PageSubtitleProps {
  subtitle: ReactNode;
}

export function PageSubtitle({ subtitle }: PageSubtitleProps) {
  return <h2 className="text-lg md:text-xl font-semibold tracking-tight">{subtitle}</h2>;
}

interface PageSubdescriptionProps {
  subdescription: ReactNode;
}

export function PageSubdescription({
  subdescription,
}: PageSubdescriptionProps) {
  return (
    <p className="text-sm md:text-sm text-muted-foreground">
      {subdescription}
    </p>
  );
}

interface PageDescriptiveSectionProps {
  children: ReactNode;
}

export function PageDescriptiveSection({
  children,
}: PageDescriptiveSectionProps) {
  return <div className="[&_*]:leading-relaxed">{children}</div>;
}

//
interface DataItemProps {
  label: ReactNode;
  value: ReactNode;
  allowCopy?: boolean;
  className?: string;
  isLoading?: boolean;
}

export function DataItem({
  label,
  value,
  allowCopy = false,
  className,
  isLoading = false,
}: DataItemProps) {
  return (
    <div className={cn(className, isLoading && "min-w-36 space-y-2")}>
      <div className="text-muted-foreground">
        {isLoading ? (
          <Skeleton className="w-1/2 h-4" />
        ) : (
          label
        )}
      </div>

      <div className="flex gap-2">
        {isLoading ? (
          <Skeleton className="w-full h-4" />
        ) : (
          <div>{value}</div>
        )}

        {allowCopy && (
          <CopyToClipboard value={value} isLoading={isLoading} />
        )}
      </div>
    </div>
  );
}