import { NextResponse } from "next/server";
import { getPresignedUrl } from "@/lib/s3";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { s3Uris, region: rawRegion } = body;
    const region = rawRegion ? String(rawRegion).split(',')[0].trim() : undefined;

    if (!s3Uris || !Array.isArray(s3Uris)) {
      return NextResponse.json({ error: "s3Uris array is required" }, { status: 400 });
    }

    // Process all signatures in parallel for maximum speed
    const signedResults = await Promise.all(
      s3Uris.map(async (uri) => {
        const cleanUri = String(uri || "").trim();
        if (!cleanUri) return { uri, url: null };
        try {
          const url = await getPresignedUrl(cleanUri, 3600, region);
          return { uri: cleanUri, url };
        } catch (err) {
          return { uri: cleanUri, url: null, error: true };
        }
      })
    );

    return NextResponse.json({ results: signedResults });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Batch presign failed", details: errorMessage }, { status: 500 });
  }
}
