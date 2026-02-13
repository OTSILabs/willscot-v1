import { db } from "@/lib/db";
import { results, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const authEmail = cookieStore.get("auth_user")?.value;

    let createdByUserId: string | null = null;
    if (authEmail) {
      const [creator] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, authEmail))
        .limit(1);
      createdByUserId = creator?.id ?? null;
    }

    const body = await req.json();
    const { video_uri, container_type, model, region_name } = body;

    const params = new URLSearchParams();
    params.append("video_uri", video_uri || "");
    params.append("container_type", container_type || "");
    params.append("model", model || "");
    params.append("region_name", region_name || "us-west-2");
    params.append("frames_bucket", "");
    params.append("frames_prefix", "");
    params.append("presigned_expiry_seconds", "");

    const response = await fetch(process.env.LAMBDA_ENDPOINT!, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const responseText = await response.text();

    let lambdaData;
    try {
      lambdaData = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { error: "Invalid Lambda response", details: responseText },
        { status: 500 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: "Lambda error", details: lambdaData },
        { status: response.status },
      );
    }

    const videoId = lambdaData.video?.video_uri || video_uri;
    const status = lambdaData.status || "completed";

    const [inserted] = await db
      .insert(results)
      .values({
        videoId: videoId,
        status: status,
        json: lambdaData,
        createdByUserId,
      })
      .returning();

    return NextResponse.json(inserted);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to process video",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
