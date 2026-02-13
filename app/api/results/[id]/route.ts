import { db } from "@/lib/db";
import { results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getPresignedUrl } from "@/lib/s3";

/**
 * Recursively scans an object for S3 URIs and replaces them with presigned URLs
 * or adds a parallel key with the presigned version.
 * For this implementation, we'll specifically target known media keys or general s3:// strings.
 */
async function processS3Uris(obj: any): Promise<any> {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return Promise.all(obj.map((item) => processS3Uris(item)));
  }

  const processed: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" && value.startsWith("s3://")) {
      processed[key] = value;
      processed[`${key}_url`] = await getPresignedUrl(value);
    } else if (typeof value === "object") {
      processed[key] = await processS3Uris(value);
    } else {
      processed[key] = value;
    }
  }
  return processed;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const [result] = await db
      .select()
      .from(results)
      .where(eq(results.id, id))
      .limit(1);

    if (!result) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    // Process the JSON to include presigned URLs for all S3 URIs
    const processedJson = await processS3Uris(result.json);

    // Also process the main videoId if it's an S3 URI
    const videoUrl = result.videoId.startsWith("s3://")
      ? await getPresignedUrl(result.videoId)
      : null;

    return NextResponse.json({
      ...result,
      json: processedJson,
      videoUrl: videoUrl,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching result detail:", errorMessage);
    return NextResponse.json(
      { error: "Failed to fetch result detail" },
      { status: 500 },
    );
  }
}
