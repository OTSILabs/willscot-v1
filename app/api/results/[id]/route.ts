import { db } from "@/lib/db";
import { results, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getPresignedUrl } from "@/lib/s3";


interface PresignedS3Result {
  original: string;
  url: string;
}


async function processS3Uris(obj: unknown): Promise<unknown> {
  if (!obj) return obj;

  if (typeof obj === "string") {
    if (obj.startsWith("s3://")) {
      return {
        original: obj,
        url: await getPresignedUrl(obj),
      } as PresignedS3Result;
    }
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return Promise.all(obj.map((item) => processS3Uris(item)));
  }

  // Handle objects
  if (typeof obj === "object" && obj !== null) {
    const processed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string" && value.startsWith("s3://")) {
        processed[key] = value;
        processed[`${key}_url`] = await getPresignedUrl(value);
      } else {
        processed[key] = await processS3Uris(value);
      }
    }
    return processed;
  }

  return obj;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const [result] = await db
      .select({
        id: results.id,
        videoId: results.videoId,
        status: results.status,
        containerType: results.containerType,
        model: results.model,
        regionName: results.regionName,
        json: results.json,
        createdByUserId: results.createdByUserId,
        createdByName: users.name,
        createdByEmail: users.email,
        createdAt: results.createdAt,
      })
      .from(results)
      .leftJoin(users, eq(results.createdByUserId, users.id))
      .where(eq(results.id, id))
      .limit(1);

    if (!result) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    // Process the JSON to include presigned URLs for all S3 URIs
    const processedJson = (await processS3Uris(result.json)) as any;

    // Polyfill feedback from error if missing, to support frontend requirements
    if (processedJson && Array.isArray(processedJson.attributes)) {
      processedJson.attributes = processedJson.attributes.map((attr: any) => ({
        ...attr,
        feedback: attr.feedback ?? attr.error ?? null,
      }));
    }

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { attributes } = body;

    if (!attributes || !Array.isArray(attributes)) {
      return NextResponse.json(
        { error: "Invalid attributes data" },
        { status: 400 },
      );
    }

    const [existing] = await db
      .select({ json: results.json })
      .from(results)
      .where(eq(results.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    const currentJson = (existing.json as Record<string, any>) || {};
    const newJson = {
      ...currentJson,
      attributes: attributes,
    };

    await db
      .update(results)
      .set({ json: newJson })
      .where(eq(results.id, id));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error updating result:", error);
    return NextResponse.json(
      { error: "Failed to update result" },
      { status: 500 },
    );
  }
}
