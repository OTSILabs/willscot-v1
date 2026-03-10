"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Users, FileText, LogOut } from "lucide-react";
import { useCurrentUser } from "./current-user-provider";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const { currentUser } = useCurrentUser();

  if (!currentUser) return null;

  const links = [
    { href: "/traces", label: "Traces", icon: FileText },
    ...(currentUser.role === "power_user"
      ? [{ href: "/users", label: "Users", icon: Users }]
      : []),
    { href: "/profile", label: "Profile", icon: User }, // We will handle profile/logout here or via a dedicated page
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t bg-background px-2 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
      {links.map((link) => {
        const isActive =
          pathname === link.href || pathname?.startsWith(link.href + "/");
        const Icon = link.icon;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 min-w-[64px] rounded-lg p-2 transition-colors",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-primary hover:bg-muted/50"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">
              {link.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
