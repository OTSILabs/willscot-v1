import { getCurrentUserServerAction } from "@/app/actions/current-user";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const user = await getCurrentUserServerAction();

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to load current user:", errorMessage);
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }
}

