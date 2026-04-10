import { db } from "@/lib/db";
import { resultAttributes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Normalizes attribute names to ensure consistent grouping on the dashboard.
 * e.g., "State Seal", "state_seal", and "state seal" all become "state_seal"
 */
function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[_-]+/g, '_');
}

export async function syncResultAttributes(tx: any, resultId: string, json: any) {
  // 1. Delete existing attributes for this result to ensure a clean sync
  await tx.delete(resultAttributes).where(eq(resultAttributes.resultId, resultId));
  
  const attributes: any[] = [];
  
  // 2. Collect from main attributes array
  if (json.attributes && Array.isArray(json.attributes)) {
    json.attributes.forEach((attr: any) => {
      attributes.push({
        ...attr,
        name: normalizeName(attr.attribute || attr.label || attr.name || "Unknown"),
        source: attr.source || "interior"
      });
    });
  }

  // 3. Insert the fresh attributes from the JSON
  if (attributes.length > 0) {
    await tx.insert(resultAttributes).values(
      attributes.map((attr: any, index: number) => ({
        resultId,
        name: attr.name,
        source: attr.source,
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
