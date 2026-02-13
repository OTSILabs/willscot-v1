import { db } from "@/lib/db";
import { results } from "@/lib/db/schema";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("Received body in API route:", body);

    const { video_uri, container_type, model, region_name } = body;

    // Based on working curl:
    // Content-Type: application/x-www-form-urlencoded
    // Keys: video_uri, container_type, model, region_name, frames_bucket, frames_prefix, presigned_expiry_seconds

    const params = new URLSearchParams();
    params.append("video_uri", video_uri || "");
    params.append("container_type", container_type || "");
    params.append("model", model || "");
    params.append("region_name", region_name || "us-west-2");
    params.append("frames_bucket", "");
    params.append("frames_prefix", "");
    params.append("presigned_expiry_seconds", "");

    console.log("Hitting Lambda with URLSearchParams:", params.toString());

    const response = await fetch(process.env.LAMBDA_ENDPOINT!, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const responseText = await response.text();
    console.log("Raw Lambda response:", responseText);

    let lambdaData;
    try {
      lambdaData = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse Lambda response as JSON:", responseText);
      return NextResponse.json(
        { error: "Invalid Lambda response", details: responseText },
        { status: 500 },
      );
    }

    if (!response.ok) {
      console.error(
        "Lambda returned error status:",
        response.status,
        lambdaData,
      );
      return NextResponse.json(
        { error: "Lambda error", details: lambdaData },
        { status: response.status },
      );
    }

    const videoId = lambdaData.video?.video_uri || video_uri;
    const status = lambdaData.status || "completed";

    const [inserted] = await db
      .insert(results)
      .values({
        videoId: videoId,
        status: status,
        json: lambdaData,
      })
      .returning();

    return NextResponse.json(inserted);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing video:", errorMessage);
    return NextResponse.json(
      {
        error: "Failed to process video",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
