"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface BackButtonProps {
  href?: string;
  label?: string;
  className?: string;
}

export function BackButton({ href = "/traces", label = "Back", className }: BackButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("px-2 -ml-2 text-muted-foreground hover:bg-accent/50 group h-8 md:h-9", className)}
      asChild
    >
      <Link href={href} className="inline-flex items-center gap-1.5 md:gap-2">
        <ArrowLeft className="h-4 w-4 md:h-4 md:w-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
        <span className="text-xs md:text-sm font-medium tracking-tight">
          {label}
        </span>
      </Link>
    </Button>
  );
}
