import { getCurrentUserServerAction } from "@/app/actions/current-user";
import { db } from "@/lib/db";
import { results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { uploadFileToS3Buffer } from "@/lib/s3";
import axios from "axios";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BATCH_LAMBDA_ENDPOINT =
  `${process.env.LAMBDA_ENDPOINT}/process-video-with-targeted-frame-batch`;

const S3_BUCKET = "ws-s3-unit-attribute-capture-nova";

type JobConfig = {
  fileName: string;
  containerType: string;
  model: string;
  region: string;
  jobType: "interior" | "exterior";
};

async function runBatchProcessingJob({
  resultId,
  jobs,
}: {
  resultId: string;
  jobs: {
    s3Uri: string;
    containerType: string;
    model: string;
    regionName: string;
    jobType: string;
  }[];
}) {
  try {
    const payload = {
      interior_jobs: jobs
        .filter((j) => j.jobType === "interior")
        .map((j) => ({
          s3_uri: j.s3Uri,
          model: j.model,
          region: j.regionName,
          container_type: j.containerType,
        })),
      exterior_jobs: jobs
        .filter((j) => j.jobType === "exterior")
        .map((j) => ({
          s3_uri: j.s3Uri,
          model: j.model,
          region: j.regionName,
          container_type: j.containerType,
        })),
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
    const files = formData.getAll("files") as File[];
    const configsStr = formData.get("configs") as string;

    if (!files.length || !configsStr) {
      return NextResponse.json(
        { error: "Missing files or configurations" },
        { status: 400 },
      );
    }

    const configs = JSON.parse(configsStr) as JobConfig[];
    const jobs: {
      s3Uri: string;
      containerType: string;
      model: string;
      regionName: string;
      jobType: string;
    }[] = [];

    const timestamp = Date.now();

    for (const file of files) {
      const config = configs.find((c) => c.fileName === file.name);
      if (!config) continue;

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = file.name.replace(/\s+/g, "_");
      const s3Key = `${config.containerType.toUpperCase()}/${timestamp}_${fileName}`;

      // 1. Upload to S3
      const s3Uri = await uploadFileToS3Buffer(
        buffer,
        S3_BUCKET,
        s3Key,
        file.type,
        config.region,
      );

      jobs.push({
        s3Uri,
        containerType: config.containerType,
        model: config.model,
        regionName: config.region,
        jobType: config.jobType,
      });
    }

    // 2. Insert initial record for the batch
    const [inserted] = await db
      .insert(results)
      .values({
        videoId: jobs.map((j) => j.s3Uri).join(","),
        status: "processing",
        containerType: jobs.map((j) => j.containerType).join(","),
        model: jobs.map((j) => j.model).join(","),
        regionName: jobs.map((j) => j.regionName).join(","),
        json: { status: "upload_success", jobs },
        createdByUserId: currentUser.id,
      })
      .returning({ id: results.id });

    // 3. Start background batch process
    void runBatchProcessingJob({
      resultId: inserted.id,
      jobs,
    });

    return NextResponse.json({ id: inserted.id, jobs }, { status: 202 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to process batch", details: error.message },
      { status: 500 },
    );
  }
}
