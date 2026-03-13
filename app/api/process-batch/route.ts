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
    const interiorJobs = jobs.filter((j) => j.jobType === "interior");
    const exteriorJobs = jobs.filter((j) => j.jobType === "exterior");
    const payload = {
      interior_jobs: interiorJobs.length > 0 ? interiorJobs.map((j) => ({
        s3_uri: j.s3Uri,
        region: j.regionName,
        container_type: j.containerType,
      })) : [],
      exterior_jobs: exteriorJobs.length > 0 ? exteriorJobs.map((j) => ({
        s3_uri: j.s3Uri,
        region: j.regionName,
        container_type: j.containerType,
      })) : [],
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

    // Validate all required fields are present
    for (const job of jobs) {
      if (!job.s3Uri || !job.containerType || !job.model || !job.region || !job.jobType) {
        return NextResponse.json(
          { error: "Each job must have s3Uri, containerType, model, region, and jobType" },
          { status: 400 },
        );
      }
    }

    // Transform jobs to match the expected format
    const formattedJobs = jobs.map((job) => ({
      s3Uri: job.s3Uri,
      containerType: job.containerType,
      model: job.model,
      regionName: job.region,
      jobType: job.jobType,
    }));

    // Insert initial record for the batch
    const [inserted] = await db
      .insert(results)
      .values({
        videoId: formattedJobs.map((j) => j.s3Uri).join(","),
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

    return NextResponse.json({ id: inserted.id, jobs: formattedJobs }, { status: 202 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to process batch", details: error.message },
      { status: 500 },
    );
  }
}
