"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface BackButtonProps {
  href?: string;
  label?: string;
  className?: string;
}

export function BackButton({ href = "/traces", label = "Back", className }: BackButtonProps) {
  const router = useRouter();
  
  const handleClick = (e: React.MouseEvent) => {
    // If it's the default href, try to go back in history first 
    // to preserve state (pagination/filters)
    if (href === "/traces" && window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("px-4 -ml-2 text-muted-foreground hover:bg-accent/50 group h-10 md:h-9", className)}
      onClick={handleClick}
      asChild
    >
      <Link href={href} className="inline-flex items-center gap-1.5 md:gap-2">
        <ArrowLeft className="h-[18px] w-[18px] md:h-4 md:w-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
        <span className="text-sm md:text-sm font-medium tracking-tight">
          {label}
        </span>
      </Link>
    </Button>
  );
}
