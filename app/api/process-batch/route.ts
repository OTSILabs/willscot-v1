import { getCurrentUserServerAction } from "@/app/actions/current-user";
import { db } from "@/lib/db";
import { results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { uploadFileToS3Buffer } from "@/lib/s3";
import axios from "axios";

const BATCH_LAMBDA_ENDPOINT =
  "https://gaxnus4wvh2o6qyznco5t3u5wm0qjmwl.lambda-url.us-west-2.on.aws/process-video-with-targeted-frame-batch";
const S3_BUCKET = "ws-s3-unit-attribute-capture-nova";

async function runBatchProcessingJob({
  resultId,
  s3Uri,
  containerType,
  model,
  regionName,
  jobType,
}: {
  resultId: string;
  s3Uri: string;
  containerType: string;
  model: string;
  regionName: string;
  jobType: string;
}) {
  try {
    const job = {
      s3_uri: s3Uri,
      model: model,
      region: regionName,
      container_type: containerType,
    };

    const payload = {
      interior_jobs: jobType === "interior" || jobType === "both" ? [job] : [],
      exterior_jobs: jobType === "exterior" || jobType === "both" ? [job] : [],
    };

    const response = await axios.post(BATCH_LAMBDA_ENDPOINT, payload, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    await db
      .update(results)
      .set({
        status: "completed",
        json: response.data,
      })
      .where(eq(results.id, resultId));
  } catch (error: any) {
    console.error(
      "Batch processing error:",
      error.response?.data || error.message,
    );
    await db
      .update(results)
      .set({
        status: "failed",
        json: {
          error: error.message,
          details: error.response?.data,
        },
      })
      .where(eq(results.id, resultId));
  }
}

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUserServerAction();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const containerType = formData.get("containerType") as string;
    const model = formData.get("model") as string;
    const regionName = (formData.get("region") as string) || "us-west-2";
    const jobType = (formData.get("jobType") as string) || "both";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.replace(/\s+/g, "_");
    const timestamp = Date.now();
    const s3Key = `${containerType.toUpperCase()}/${timestamp}_${fileName}`;

    // 1. Upload to S3
    const s3Uri = await uploadFileToS3Buffer(
      buffer,
      S3_BUCKET,
      s3Key,
      file.type,
      regionName,
    );

    // 2. Insert initial record
    const [inserted] = await db
      .insert(results)
      .values({
        videoId: s3Uri,
        status: "processing",
        containerType: containerType,
        model: model,
        regionName: regionName,
        json: { status: "upload_success", s3Uri, jobType },
        createdByUserId: currentUser.id,
      })
      .returning({ id: results.id });

    // 3. Start background batch process
    void runBatchProcessingJob({
      resultId: inserted.id,
      s3Uri,
      containerType,
      model,
      regionName,
      jobType,
    });

    return NextResponse.json({ id: inserted.id, s3Uri }, { status: 202 });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Failed to process video", details: error.message },
      { status: 500 },
    );
  }
}
