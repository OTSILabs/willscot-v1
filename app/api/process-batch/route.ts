import { getCurrentUserServerAction } from "@/app/actions/current-user";
import { db } from "@/lib/db";
import { resultAttributes, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import axios from "axios";
import { waitUntil } from "@vercel/functions";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const LAMBDA_BASE = (process.env.LAMBDA_ENDPOINT || "").trim().replace(/\/$/, "");
const BATCH_LAMBDA_ENDPOINT = `${LAMBDA_BASE}/process-video-with-targeted-frame-batch-pegasus`;

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
    evidencePhotos?: string[];
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
      image_s3_uris: (jobs.find(j => (j as any).evidencePhotos)?.evidencePhotos || []).join(","),
      temperature: 0.2,
    };

    console.log("payload :", payload);

    const response = await axios.post(BATCH_LAMBDA_ENDPOINT, payload, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    const resultData = response.data;
    
    // Pruning redundant fields from resultData to optimize DB size and frontend speed
    const prunedResultData = {
      ...resultData,
      // Map through loads to remove massive raw outputs that aren't needed by the UI
      loads: Array.isArray(resultData?.loads) 
        ? resultData.loads.map((load: any) => ({
            ...load,
            results: undefined, // Remove raw outputs (already extracted into 'attributes' or 'loads.loads')
          }))
        : resultData?.loads,
      // Remove any top-level raw fields if they exist
      results: undefined,
    };

    // Collect attributes from top-level and also from each load (image results)
    const attributes = [...(resultData?.attributes || [])];
    if (Array.isArray(resultData?.loads)) {
      resultData.loads.forEach((load: any) => {
        if (load.results?.attributes && Array.isArray(load.results.attributes)) {
          load.results.attributes.forEach((attr: any) => {
            attributes.push({
              ...attr,
              source: attr.source || `image:${load.image_s3_uri}`,
            });
          });
        }
      });
    }

    await db.transaction(async (tx) => {
      // 1. Update the main record
      await tx
        .update(results)
        .set({
          status: "completed",
          json: {
            ...prunedResultData,
            // Keep evidencePhotos for UI compatibility by mapping from the new 'loads' structure
            // or falling back to the original uploaded photos
            evidencePhotos: (resultData?.loads && Array.isArray(resultData.loads))
              ? resultData.loads.map((load: any) => ({
                  original: load.image_s3_uri,
                  url: load.image_s3_uri_url || load.original_url || null
                }))
              : (jobs.find(j => (j as any).evidencePhotos)?.evidencePhotos || []),
          },
        })
        .where(eq(results.id, resultId));

      // 2. Sync specialized attributes table if any
      if (Array.isArray(attributes) && attributes.length > 0) {
        type AttributeInput = { attribute?: string; label?: string; name?: string; source?: string; value?: string | number; confidence?: number; timestamp?: number };
        await tx.insert(resultAttributes).values(
          attributes.map((attr: AttributeInput) => ({
            resultId: resultId,
            name: attr.attribute || attr.label || attr.name || "Unknown",
            source: attr.source || "interior",
            value: String(attr.value || ""),
            status: "unmarked" as const, // Initial state is unmarked
            confidence: attr.confidence || null,
            timestamp: attr.timestamp || null,
          }))
        );
      }
    });
  } catch (error: unknown) {
    const err = error as { response?: { data?: unknown }, message?: string };
    console.error(
      "Batch processing error:",
      err.response?.data || err.message,
    );
    await db
      .update(results)
      .set({
        status: "failed",
        json: {
          error: err.message || "Unknown error",
          details: err.response?.data,
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

    const { jobs, evidencePhotos } = await req.json();
    
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
        json: { 
          status: "upload_success", 
          jobs: formattedJobs,
          evidencePhotos: evidencePhotos || []
        },
        createdByUserId: currentUser.id,
      })
      .returning({ id: results.id });

    // Start background batch process
    waitUntil(
      runBatchProcessingJob({
        resultId: inserted.id,
        jobs: formattedJobs.map(j => ({ ...j, evidencePhotos })),
      })
    );

    return NextResponse.json({ id: inserted.id, customId, jobs: formattedJobs }, { status: 202 });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: "Failed to process batch", details: err.message || "Unknown error" },
      { status: 500 },
    );
  }
}
