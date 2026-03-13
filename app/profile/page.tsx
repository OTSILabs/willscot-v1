"use client";

import { useCurrentUser } from "@/components/current-user-provider";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export default function ProfilePage() {
  const { currentUser, setCurrentUser } = useCurrentUser();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  if (!currentUser) return null;

  return (
    <div className="container mx-auto px-0 md:px-0 py-4 md:py-10 space-y-6 md:space-y-8 max-w-2xl">
      <div className="text-center md:text-left">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Your Profile</h1>
        <p className="text-xs md:text-base text-muted-foreground mt-1">
          View your account information and preferences.
        </p>
      </div>

      <div className="border-none shadow-none bg-transparent md:border md:rounded-xl p-0 md:p-8 md:bg-card text-card-foreground md:shadow-sm flex flex-col gap-4 md:gap-6 mx-auto w-full max-w-sm md:max-w-full">
        <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4 border-b pb-4 md:pb-6">
          <div className="w-16 h-16 md:w-16 md:h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold text-2xl md:text-xl shrink-0">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col gap-1 items-center md:items-start text-center md:text-left">
            <h2 className="text-xl md:text-xl font-semibold leading-none">{currentUser.name}</h2>
            <p className="text-xs md:text-sm text-muted-foreground">{currentUser.email}</p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="flex justify-between items-center py-2">
            <span className="text-sm font-medium text-muted-foreground">Role</span>
            <Badge variant="secondary" className="uppercase text-[10px] tracking-wider font-semibold">
              {currentUser.role === "power_user" ? "Power User" : "Normal User"}
            </Badge>
          </div>
        </div>

        <div className="border-t pt-4 md:pt-6 flex flex-col gap-3">
          <Button
            variant="destructive"
            size="sm"
            className="w-full md:w-auto md:h-10 md:px-4"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            {isLoggingOut ? "Logging out..." : "Logout"}
          </Button>
        </div>
      </div>
    </div>
  );
}
