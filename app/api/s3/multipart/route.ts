import { NextRequest, NextResponse } from "next/server";
import {
  initiateMultipartUpload,
  getPresignedPartUrls,
  completeMultipartUpload,
  abortMultipartUpload,
} from "@/lib/s3";
import { getCurrentUserServerAction } from "@/app/actions/current-user";

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserServerAction();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, bucket, key, uploadId, contentType, region, parts, partsCount } = body;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    switch (action) {
      case "INITIATE":
        if (!bucket || !key || !contentType) {
          return NextResponse.json({ error: "Missing required fields for INITIATE" }, { status: 400 });
        }
        const session = await initiateMultipartUpload(bucket, key, contentType, region);
        return NextResponse.json(session);

      case "PRESIGN_PARTS":
        if (!bucket || !key || !uploadId || !partsCount) {
          return NextResponse.json({ error: "Missing required fields for PRESIGN_PARTS" }, { status: 400 });
        }
        const urls = await getPresignedPartUrls(bucket, key, uploadId, partsCount, region);
        return NextResponse.json({ urls });

      case "COMPLETE":
        if (!bucket || !key || !uploadId || !parts) {
          return NextResponse.json({ error: "Missing required fields for COMPLETE" }, { status: 400 });
        }
        const result = await completeMultipartUpload(bucket, key, uploadId, parts, region);
        return NextResponse.json(result);

      case "ABORT":
        if (!bucket || !key || !uploadId) {
          return NextResponse.json({ error: "Missing required fields for ABORT" }, { status: 400 });
        }
        await abortMultipartUpload(bucket, key, uploadId, region);
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Multipart API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
