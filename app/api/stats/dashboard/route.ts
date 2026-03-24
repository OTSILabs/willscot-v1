import { db } from "@/lib/db";
import { resultAttributes, results } from "@/lib/db/schema";
import { eq, sql, avg, count, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // 1. Calculate overall, interior, and exterior averages
    const overallStats = await db
      .select({
        total: count(resultAttributes.id),
        correct: sql`count(case when ${resultAttributes.status} = 'correct' then 1 end)`,
        incorrect: sql`count(case when ${resultAttributes.status} = 'incorrect' then 1 end)`,
        unmarked: sql`count(case when ${resultAttributes.status} = 'unmarked' then 1 end)`,
      })
      .from(resultAttributes);

    const sourceStats = await db
      .select({
        source: resultAttributes.source,
        total: count(resultAttributes.id),
        correct: sql`count(case when ${resultAttributes.status} = 'correct' then 1 end)`,
        incorrect: sql`count(case when ${resultAttributes.status} = 'incorrect' then 1 end)`,
        unmarked: sql`count(case when ${resultAttributes.status} = 'unmarked' then 1 end)`,
      })
      .from(resultAttributes)
      .groupBy(resultAttributes.source);

    // 2. Calculate per-attribute accuracy
    const attributeStats = await db
      .select({
        name: resultAttributes.name,
        total: count(resultAttributes.id),
        correct: sql`count(case when ${resultAttributes.status} = 'correct' then 1 end)`,
        incorrect: sql`count(case when ${resultAttributes.status} = 'incorrect' then 1 end)`,
        unmarked: sql`count(case when ${resultAttributes.status} = 'unmarked' then 1 end)`,
      })
      .from(resultAttributes)
      .groupBy(resultAttributes.name);

    // 3. Determine dynamic display order from the most recent result tracking
    // We look at the top 50 recent traces to ensure we account for any rare missing attributes
    const latestResult = await db
      .select({ json: results.json })
      .from(results)
      .where(sql`${results.json} IS NOT NULL`)
      .orderBy(desc(results.createdAt))
      .limit(50);

    // Find the single trace with the highest number of attributes to act as the primary template
    let bestTrace: any[] = [];
    for (const res of latestResult) {
      const json = res.json as any;
      if (json && Array.isArray(json.attributes)) {
        if (json.attributes.length > bestTrace.length) {
          bestTrace = json.attributes;
        }
      }
    }

    let dynamicOrder = new Map<string, number>();
    
    // Step A: Populate order from the most complete trace we found
    bestTrace.forEach((attr: any, index: number) => {
      const name = attr.attribute || attr.label || attr.name || "Unknown";
      if (!dynamicOrder.has(name)) {
        dynamicOrder.set(name, index);
      }
    });

    // Step B: Fill in any absolutely missing ones from other recent traces at the end
    let nextIndex = dynamicOrder.size;
    for (const res of latestResult) {
      const json = res.json as any;
      if (json && Array.isArray(json.attributes)) {
        json.attributes.forEach((attr: any) => {
          const name = attr.attribute || attr.label || attr.name || "Unknown";
          if (!dynamicOrder.has(name)) {
            dynamicOrder.set(name, nextIndex++);
          }
        });
      }
    }

    // Format the response for easy consumption by the dashboard
    const formatPercent = (correct: any, total: any) => 
      total > 0 ? Math.round((Number(correct) / Number(total)) * 100) : 0;

    // Helper to format "RestroomWaterCloset" to "Restroom Water Closet"
    const formatAttributeName = (name: string) => {
      return name.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
    };

    const interior = sourceStats.find(s => s.source === 'interior');
    const exterior = sourceStats.find(s => s.source === 'exterior');

    return NextResponse.json({
      overview: {
        overall: {
          accuracy: formatPercent(overallStats[0].correct, Number(overallStats[0].total) - Number(overallStats[0].unmarked)),
          correct: overallStats[0].correct,
          incorrect: overallStats[0].incorrect,
          unmarked: overallStats[0].unmarked,
          total: overallStats[0].total
        },
        interior: {
          accuracy: formatPercent(interior?.correct, Number(interior?.total || 0) - Number(interior?.unmarked || 0)),
          correct: interior?.correct || 0,
          incorrect: interior?.incorrect || 0,
          unmarked: interior?.unmarked || 0,
        },
        exterior: {
          accuracy: formatPercent(exterior?.correct, Number(exterior?.total || 0) - Number(exterior?.unmarked || 0)),
          correct: exterior?.correct || 0,
          incorrect: exterior?.incorrect || 0,
          unmarked: exterior?.unmarked || 0,
        },
      },
      attributes: attributeStats.map(attr => {
        const reviewed = Number(attr.total) - Number(attr.unmarked);
        return {
          originalName: attr.name, // Keep original for sorting reference
          name: formatAttributeName(attr.name),
          accuracy: formatPercent(attr.correct, reviewed),
          correct: attr.correct,
          incorrect: attr.incorrect,
          unmarked: attr.unmarked,
          totalTraces: attr.total
        };
      }).sort((a, b) => {
        const orderA = dynamicOrder.has(a.originalName) ? dynamicOrder.get(a.originalName)! : 999;
        const orderB = dynamicOrder.has(b.originalName) ? dynamicOrder.get(b.originalName)! : 999;
        return orderA - orderB;
      }).map(({ originalName, ...rest }) => rest) // Clean up originalName from final payload
    });

  } catch (error) {
    console.error("Dashboard stats failed:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
