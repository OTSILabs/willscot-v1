"use client";

import { useCurrentUser } from "@/components/current-user-provider";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { PageTitle, PageDescription } from "@/components/typography";

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
    <div className="container mx-auto px-4 xl:px-0 py-4 xl:py-10 space-y-4 xl:space-y-6 max-w-2xl">
      <div className="flex items-center">
        <BackButton label="Back to Traces" />
      </div>

      <div className="text-center xl:text-left space-y-1">
        <PageTitle title="Your Profile" />
        <PageDescription description="View your account information and preferences." />
      </div>

      <div className="border-none shadow-none bg-transparent xl:border xl:rounded-xl p-0 xl:p-8 xl:bg-card text-card-foreground xl:shadow-sm flex flex-col gap-4 xl:gap-6 mx-auto w-full max-w-sm xl:max-w-full">
        <div className="flex flex-col xl:flex-row items-center gap-3 xl:gap-4 border-b pb-4 xl:pb-6">
          <div className="w-16 h-16 xl:w-16 xl:h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold text-2xl xl:text-xl shrink-0">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col gap-1 items-center xl:items-start text-center xl:text-left">
            <h2 className="text-xl xl:text-xl font-semibold leading-none">{currentUser.name}</h2>
            <p className="text-xs xl:text-sm text-muted-foreground">{currentUser.email}</p>
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

        <div className="border-t pt-4 xl:pt-6 flex flex-col gap-3">
          <Button
            variant="destructive"
            size="sm"
            className="w-full xl:w-auto xl:h-10 xl:px-4"
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
