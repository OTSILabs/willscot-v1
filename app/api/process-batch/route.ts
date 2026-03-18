import { getCurrentUserServerAction } from "@/app/actions/current-user";
import { db } from "@/lib/db";
import { results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import axios from "axios";
import { waitUntil } from "@vercel/functions";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BATCH_LAMBDA_ENDPOINT =
  `${process.env.LAMBDA_ENDPOINT}/process-video-with-targeted-frame-batch-pegasus`;

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
    const mapJobs = (type: string) => jobs
      .filter((j) => j.jobType === type)
      .map((j) => ({
        s3_uri: j.s3Uri,
        region: j.regionName,
        container_type: j.containerType,
      }));

    const payload = {
      interior_jobs: mapJobs("interior"),
      exterior_jobs: mapJobs("exterior"),
      temperature: 0.2,
    };

    console.log("payload :", payload);

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

    const body = await req.json();
    const jobs = body.jobs as {
      s3Uri: string;
      fileName: string;
      containerType: string;
      model: string;
      region: string;
      jobType: "interior" | "exterior";
    }[];

    if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid jobs array" },
        { status: 400 },
      );
    }

    // Transform and validate jobs
    const formattedJobs = jobs.map((job) => {
      if (!job.s3Uri || !job.containerType || !job.model || !job.region || !job.jobType) {
        throw new Error("Missing required fields in job data");
      }
      return {
        s3Uri: job.s3Uri,
        fileName: job.fileName,
        containerType: job.containerType,
        model: job.model,
        regionName: job.region,
        jobType: job.jobType,
      };
    });

    // Insert initial record for the batch
    const customId = `TRC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const [inserted] = await db
      .insert(results)
      .values({
        videoId: formattedJobs.map((j) => j.s3Uri).join(","),
        videoName: formattedJobs.map((j) => j.fileName).join(","),
        customId: customId,
        status: "processing",
        containerType: formattedJobs.map((j) => j.containerType).join(","),
        model: formattedJobs.map((j) => j.model).join(","),
        regionName: formattedJobs.map((j) => j.regionName).join(","),
        json: { status: "upload_success", jobs: formattedJobs },
        createdByUserId: currentUser.id,
      })
      .returning({ id: results.id });

    // Start background batch process
    waitUntil(
      runBatchProcessingJob({
        resultId: inserted.id,
        jobs: formattedJobs,
      })
    );

    return NextResponse.json({ id: inserted.id, customId, jobs: formattedJobs }, { status: 202 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to process batch", details: error.message },
      { status: 500 },
    );
  }
}
