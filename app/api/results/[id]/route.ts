import { db } from "@/lib/db";
import { results, users, resultAttributes } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getPresignedUrl } from "@/lib/s3";
import { getCurrentUserServerAction } from "@/app/actions/current-user";
import { syncResultAttributes } from "@/lib/db/sync";


interface PresignedS3Result {
  original: string;
  url: string;
}


async function processS3Uris(obj: unknown): Promise<unknown> {
  if (!obj) return obj;

  if (typeof obj === "string") {
    if (obj.startsWith("s3://")) {
      // Handle comma-separated URIs by signing each part (if it's a known multi-field)
      // or just the first part for simple strings.
      const uris = obj.split(",");
      if (uris.length > 1) {
        return Promise.all(uris.map(async (uri) => ({
          original: uri,
          url: await getPresignedUrl(uri),
        })));
      }
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
        const uris = value.split(",");
        processed[key] = value;
        // For the '_url' helper, use the first one if multiple
        processed[`${key}_url`] = await getPresignedUrl(uris[0]);
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
    const currentUser = await getCurrentUserServerAction();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const filter = currentUser.role === "power_user" ? undefined : eq(results.createdByUserId, currentUser.id);
    
    // Self-healing: Retry with small delays if record not found initially (DB replication lag)
    let resultsList: any[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      resultsList = await db
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
          videoName: results.videoName,
          customId: results.customId,
        })
        .from(results)
        .leftJoin(users, eq(results.createdByUserId, users.id))
        .where(and(eq(results.id, id), filter))
        .limit(1);

      if (resultsList.length > 0) break;
      if (attempt < 2) {
        console.log(`Result not found for ${id}, retrying in 800ms (Attempt ${attempt + 1}/3)...`);
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    const result = resultsList[0];

    if (!result) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    // Process the JSON to include presigned URLs for all S3 URIs
    const processedJson = (await processS3Uris(result.json)) as {
      attributes?: Record<string, unknown>[];
      [key: string]: unknown;
    };

    // Upgrade "wrong" to "incorrect" for backward compatibility and polyfill feedback from error
    if (processedJson && Array.isArray(processedJson.attributes)) {
      processedJson.attributes = processedJson.attributes.map((attr) => ({
        ...attr,
        status: attr.status === "wrong" ? "incorrect" : attr.status,
        feedback: attr.feedback ?? attr.error ?? null,
      }));
    }

    // Also process the main videoId if it's an S3 URI (Handle multi-video strings)
    const videoUris = result.videoId?.split(",") || [];
    const videoUrl = videoUris.length > 0 && videoUris[0].startsWith("s3://")
      ? await getPresignedUrl(videoUris[0])
      : null;

    // Background self-healing for specialized table
    if (result.status === "completed" && Array.isArray(processedJson.attributes)) {
      const attributes = processedJson.attributes;
      (async () => {
        try {
          await db.transaction(async (tx) => {
            await syncResultAttributes(tx, id, attributes);
          });
        } catch (e) {
          console.error("Self-healing sync failed for trace:", id, e);
        }
      })();
    }

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
      { error: "Failed to fetch result detail", details: errorMessage },
      { status: 500 },
    );
  }
}
//
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUserServerAction();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { attributes } = body;

    if (!attributes || !Array.isArray(attributes)) {
      return NextResponse.json(
        { error: "Invalid attributes data" },
        { status: 400 },
      );
    }

    const [existing] = await db
      .select({ 
        json: results.json,
        createdByUserId: results.createdByUserId 
      })
      .from(results)
      .where(eq(results.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    if (currentUser.role !== "power_user" && existing.createdByUserId !== currentUser.id) {
      return NextResponse.json(
        { error: "Forbidden: You can only update your own traces" },
        { status: 403 }
      );
    }

    const currentJson = (existing.json as Record<string, unknown>) || {};
    const newJson = {
      ...currentJson,
      attributes: attributes,
    };

    await db.transaction(async (tx) => {
      // 1. Update the main JSON
      await tx
        .update(results)
        .set({ json: newJson })
        .where(eq(results.id, id));

      // 2. Sync specialized attributes table using centralized helper
      await syncResultAttributes(tx, id, attributes);
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error updating result:", errorMessage);
    return NextResponse.json(
      { error: "Failed to update result", details: errorMessage },
      { status: 500 },
    );
  }
}
