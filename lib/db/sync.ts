import { db } from "@/lib/db";
import { resultAttributes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function syncResultAttributes(tx: any, resultId: string, attributes: any[]) {
  // 1. Delete existing attributes for this result to ensure a clean sync
  await tx.delete(resultAttributes).where(eq(resultAttributes.resultId, resultId));
  
  // 2. Insert the fresh attributes from the JSON
  if (attributes && attributes.length > 0) {
    await tx.insert(resultAttributes).values(
      attributes.map((attr: any, index: number) => ({
        resultId,
        name: attr.attribute || attr.label || attr.name || "Unknown",
        source: attr.source || "interior",
        value: String(attr.value || ""),
        status: ((attr.status === "correct" || attr.feedback === "Correct") ? "correct" : 
                (attr.status === "wrong" || attr.status === "incorrect" || attr.feedback === "Incorrect") ? "incorrect" : "unmarked"),
        confidence: attr.confidence || null,
        timestamp: attr.timestamp || null,
        orderIndex: index,
      }))
    );
  }
}
