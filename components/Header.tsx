"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { useCurrentUser } from "@/components/current-user-provider";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, setCurrentUser } = useCurrentUser();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navLinks = [{ href: "/traces", label: "Traces" },
  ...(currentUser?.role === "power_user" ? [{ href: "/users", label: "Users" }] : []),
  ];

  const userInitials = useMemo(() => {
    if (!currentUser?.name) return "U";
    const parts = currentUser.name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }, [currentUser?.name]);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setCurrentUser(null);
      router.push("/login");
      router.refresh();
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex h-16 items-center justify-between px-10">
        <div className="flex items-center gap-2">
          <Link href="/traces" className="flex items-center space-x-2">
            <BrandLogo />
          </Link>
        </div>
        <div className="flex items-center gap-6">
          <NavigationMenu viewport={false} className="flex items-center gap-4">
            <NavigationMenuList>
              {navLinks.map((link) => {
                const isActive = pathname === link.href || pathname?.startsWith(link.href + "/");
                return (
                  <NavigationMenuItem key={link.href}>
                    <NavigationMenuLink asChild>
                      <Link
                        href={link.href}
                        data-active={isActive}
                        className="group inline-flex h-9 w-max items-center justify-center rounded-md border border-transparent bg-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/70 hover:text-accent-foreground focus:bg-accent/70 focus:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[active=true]:border-border data-[active=true]:bg-accent data-[active=true]:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                );
              })}
            </NavigationMenuList>
          </NavigationMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                aria-label="Open user menu"
              >
                <span className="text-xs font-semibold">{userInitials}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="space-y-1">
                <p className="text-sm font-medium leading-none">
                  {currentUser?.name || "User"}
                </p>
                <p className="text-muted-foreground text-xs leading-none">
                  {currentUser?.email || "Not available"}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                <LogOut className="size-4" />
                {isLoggingOut ? "Logging out..." : "Logout"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
