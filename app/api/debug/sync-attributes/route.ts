import { db } from "@/lib/db";
import { results, resultAttributes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const allResults = await db.select().from(results);
    let totalSynced = 0;

    for (const res of allResults) {
      const json = res.json as any;
      if (json && Array.isArray(json.attributes)) {
        // Clear existing for this result to avoid duplicates
        await db.delete(resultAttributes).where(eq(resultAttributes.resultId, res.id));

        if (json.attributes.length > 0) {
          await db.insert(resultAttributes).values(
            json.attributes.map((attr: any) => ({
              resultId: res.id,
              name: attr.attribute || attr.label || attr.name || "Unknown",
              source: attr.source || "interior",
              value: String(attr.value || ""),
              status: (attr.status === "correct" || attr.feedback === "Correct" || attr.isCorrect === true) ? "correct" : 
                      (attr.status === "wrong" || attr.status === "incorrect" || attr.feedback === "Incorrect" || attr.isCorrect === false) ? "incorrect" : "unmarked",
              confidence: attr.confidence || null,
              timestamp: attr.timestamp || null,
            }))
          );
          totalSynced++;
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully synced ${totalSynced} results into result_attributes table.` 
    });
  } catch (error) {
    console.error("Migration failed:", error);
    return NextResponse.json({ error: "Migration failed" }, { status: 500 });
  }
}
