import { db } from "@/lib/db";
import { results, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function runProcessingJob({
  resultId,
  videoUri,
  containerType,
  model,
  regionName,
}: {
  resultId: string;
  videoUri: string;
  containerType: string;
  model: string;
  regionName: string;
}) {
  try {
    const configuredTimeoutMs = Number(process.env.LAMBDA_TIMEOUT_MS ?? "180000");
    const timeoutMs =
      Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
        ? configuredTimeoutMs
        : 180000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const params = new URLSearchParams();
    params.append("video_uri", videoUri);
    params.append("container_type", containerType);
    params.append("model", model);
    params.append("region_name", regionName);
    params.append("frames_bucket", "");
    params.append("frames_prefix", "");
    params.append("presigned_expiry_seconds", "");
    params.append("result_id", resultId);

    let response: Response;
    try {
      response = await fetch(process.env.LAMBDA_ENDPOINT!, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
        signal: controller.signal,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Lambda request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    const responseText = await response.text();
    let lambdaData: unknown;

    try {
      lambdaData = JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid Lambda response: ${responseText}`);
    }

    if (!response.ok) {
      throw new Error(
        `Lambda error (${response.status}): ${JSON.stringify(lambdaData)}`,
      );
    }

    const parsed = lambdaData as {
      status?: string;
      video?: { video_uri?: string };
    };

    await db
      .update(results)
      .set({
        status: parsed.status || "completed",
        videoId: parsed.video?.video_uri || videoUri,
        json: lambdaData,
      })
      .where(eq(results.id, resultId));
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown background processing error";

    try {
      await db
        .update(results)
        .set({
          status: "failed",
          json: {
            status: "failed",
            error: errorMessage,
            video: {
              video_uri: videoUri,
              region: regionName,
              container_type: containerType,
            },
            attributes: [],
          },
        })
        .where(eq(results.id, resultId));
    } catch (updateError: unknown) {
      const updateErrorMessage =
        updateError instanceof Error ? updateError.message : "Unknown DB update error";
      console.error("Failed to mark result as failed:", updateErrorMessage);
    }
  }
}

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
    const safeVideoUri = String(video_uri || "");
    const safeContainerType = String(container_type || "");
    const safeModel = String(model || "");
    const safeRegionName = String(region_name || "us-west-2");

    const [inserted] = await db
      .insert(results)
      .values({
        videoId: safeVideoUri,
        status: "processing",
        json: {
          status: "processing",
          video: {
            video_uri: safeVideoUri,
            region: safeRegionName,
            container_type: safeContainerType,
          },
          attributes: [],
        },
        createdByUserId,
      })
      .returning({ id: results.id, status: results.status });

    void runProcessingJob({
      resultId: inserted.id,
      videoUri: safeVideoUri,
      containerType: safeContainerType,
      model: safeModel,
      regionName: safeRegionName,
    });

    return NextResponse.json(inserted, { status: 202 });
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
