import { db } from "@/lib/db";
import { results, resultAttributes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const allResults = await db.select().from(results);
    const allAttributes: any[] = [];
    let totalSynced = 0;

    for (const res of allResults) {
      const json = res.json as any;
      if (json && Array.isArray(json.attributes)) {
        for (const attr of json.attributes) {
          allAttributes.push({
            resultId: res.id,
            name: attr.attribute || attr.label || attr.name || "Unknown",
            source: attr.source || "interior",
            value: String(attr.value || ""),
            status: (attr.status === "correct" || attr.feedback === "Correct" || attr.isCorrect === true) ? "correct" : 
                    (attr.status === "wrong" || attr.status === "incorrect" || attr.feedback === "Incorrect" || attr.isCorrect === false) ? "incorrect" : "unmarked",
            confidence: attr.confidence || null,
            timestamp: attr.timestamp || null,
          });
        }
        totalSynced++;
      }
    }

    // Clear existing and perform bulk insert in chunks
    await db.delete(resultAttributes);
    
    // Chunking to avoid large query limits (e.g., 500 at a time)
    const chunkSize = 500;
    for (let i = 0; i < allAttributes.length; i += chunkSize) {
      const chunk = allAttributes.slice(i, i + chunkSize);
      await db.insert(resultAttributes).values(chunk);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully synced ${allAttributes.length} attributes across ${totalSynced} results.` 
    });
  } catch (error) {
    console.error("Migration failed:", error);
    return NextResponse.json({ error: "Migration failed", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
