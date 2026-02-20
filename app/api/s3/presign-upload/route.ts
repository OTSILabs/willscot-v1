import { getCurrentUserServerAction } from "@/app/actions/current-user";
import { NextResponse } from "next/server";
import { getPresignedUploadUrl } from "@/lib/s3";

const S3_BUCKET = "ws-s3-unit-attribute-capture-nova";

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUserServerAction();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      fileName: string;
      containerType: string;
      region?: string;
      contentType?: string;
    };

    const { fileName, containerType, region, contentType } = body;

    if (!fileName || !containerType) {
      return NextResponse.json(
        { error: "fileName and containerType are required" },
        { status: 400 },
      );
    }

    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/\s+/g, "_");
    const s3Key = `${containerType.toUpperCase()}/${timestamp}_${sanitizedFileName}`;
    const s3Uri = `s3://${S3_BUCKET}/${s3Key}`;

    const presignedUrl = await getPresignedUploadUrl(
      S3_BUCKET,
      s3Key,
      contentType || "video/mp4",
      3600, // 1 hour expiry
      region,
    );

    return NextResponse.json({
      presignedUrl,
      s3Uri,
      s3Key,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: "Failed to generate presigned upload url", details: errorMessage },
      { status: 500 },
    );
  }
}

