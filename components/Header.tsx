"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { KeyRound, LogOut, Menu } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, setCurrentUser } = useCurrentUser();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Password Change State
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");

    if (!newPassword || newPassword.trim() === "") {
      setErrorMessage("Password cannot be empty.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch(`/api/users/${currentUser?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      setSuccessMessage("Password successfully updated.");
      setNewPassword("");
      setConfirmPassword("");
      
      // Auto-close after 1.5 seconds on success
      setTimeout(() => {
        setIsPasswordDialogOpen(false);
        setSuccessMessage("");
      }, 1500);

    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "An unexpected error occurred."
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4 md:px-10">
        <div className="flex items-center gap-2">
          <Link href="/traces" className="flex items-center space-x-2">
            <BrandLogo />
          </Link>
        </div>
        <div className="flex items-center gap-2 md:gap-6">
          <NavigationMenu viewport={false} className="hidden md:flex items-center gap-4">
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

          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full" aria-label="Menu">
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Navigation</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {navLinks.map((link) => (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link href={link.href} className="w-full cursor-pointer">
                      {link.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

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
                onClick={() => {
                  setErrorMessage("");
                  setSuccessMessage("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setIsPasswordDialogOpen(true);
                }}
              >
                <KeyRound className="size-4 mr-2" />
                Change Password
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                <LogOut className="size-4 mr-2" />
                {isLoggingOut ? "Logging out..." : "Logout"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter a new secure password for your account.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
              />
            </div>
            {errorMessage && (
              <p className="text-xs text-destructive font-medium">{errorMessage}</p>
            )}
            {successMessage && (
              <p className="text-xs text-green-600 dark:text-green-500 font-medium">{successMessage}</p>
            )}
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={isChangingPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              >
                {isChangingPassword ? "Saving..." : "Save Password"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </header>
  );
}
