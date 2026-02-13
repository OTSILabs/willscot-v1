import { NextResponse } from "next/server";
import { getPresignedUrl } from "@/lib/s3";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { s3Uri?: string; region?: string };
    const s3Uri = String(body?.s3Uri || "").trim();
    const region = String(body?.region || "").trim() || undefined;

    if (!s3Uri) {
      return NextResponse.json({ error: "s3Uri is required" }, { status: 400 });
    }

    const url = await getPresignedUrl(s3Uri, 3600, region);
    return NextResponse.json({ url });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate presigned url", details: errorMessage },
      { status: 500 },
    );
  }
}


