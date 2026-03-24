import { getCurrentUserServerAction } from "@/app/actions/current-user";
import { db } from "@/lib/db";
import { resultAttributes, results } from "@/lib/db/schema";
import { and, eq, sql, count, desc, gte, lte } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const currentUser = await getCurrentUserServerAction();
    if (!currentUser || currentUser.role !== "power_user") {
      return NextResponse.json({ error: "Forbidden: Power User access required" }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const timezone = searchParams.get("timezone") || "UTC";

    const filters = [];
    if (userId && userId !== "all") {
      filters.push(eq(results.createdByUserId, userId));
    }
    
    // Timezone-aware date filtering by converting UTC timestamp to user's local time before DATE extraction
    if (startDate) {
      filters.push(gte(sql<string>`DATE(${results.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})`, startDate));
    }
    if (endDate) {
      filters.push(lte(sql<string>`DATE(${results.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})`, endDate));
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    // --- Self-Healing Sync: Ensure any completed traces have their attributes synced ---
    // This handles traces created before the auto-sync fix or during edge cases.
    const completedWithoutAttrs = await db
      .select({ id: results.id, json: results.json })
      .from(results)
      .leftJoin(resultAttributes, eq(results.id, resultAttributes.resultId))
      .where(and(
        eq(results.status, 'completed'),
        sql`${resultAttributes.id} IS NULL`,
        whereClause ? whereClause : sql`TRUE`
      ))
      .limit(20);

    if (completedWithoutAttrs.length > 0) {
      await db.transaction(async (tx) => {
        type AttributeData = { attribute?: string; label?: string; name?: string; source?: string; value?: string | number; confidence?: number; timestamp?: number };
        for (const res of completedWithoutAttrs) {
          const attributes = (res.json as { attributes?: AttributeData[] })?.attributes;
          if (Array.isArray(attributes) && attributes.length > 0) {
            await tx.insert(resultAttributes).values(
              attributes.map((attr) => ({
                resultId: res.id,
                name: attr.attribute || attr.label || attr.name || "Unknown",
                source: attr.source || "interior",
                value: String(attr.value || ""),
                status: "unmarked" as const,
                confidence: attr.confidence || null,
                timestamp: attr.timestamp || null,
              }))
            ).onConflictDoNothing();
          }
        }
      });
    }

    // 1. Calculate overall, interior, and exterior averages
    const overallStats = await db
      .select({
        total: count(resultAttributes.id),
        correct: sql`count(case when ${resultAttributes.status} = 'correct' then 1 end)`,
        incorrect: sql`count(case when ${resultAttributes.status} = 'incorrect' then 1 end)`,
        unmarked: sql`count(case when ${resultAttributes.status} = 'unmarked' then 1 end)`,
      })
      .from(resultAttributes)
      .innerJoin(results, eq(resultAttributes.resultId, results.id))
      .where(whereClause);

    const sourceStats = await db
      .select({
        source: resultAttributes.source,
        total: count(resultAttributes.id),
        correct: sql`count(case when ${resultAttributes.status} = 'correct' then 1 end)`,
        incorrect: sql`count(case when ${resultAttributes.status} = 'incorrect' then 1 end)`,
        unmarked: sql`count(case when ${resultAttributes.status} = 'unmarked' then 1 end)`,
      })
      .from(resultAttributes)
      .innerJoin(results, eq(resultAttributes.resultId, results.id))
      .where(whereClause)
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
      .innerJoin(results, eq(resultAttributes.resultId, results.id))
      .where(whereClause)
      .groupBy(resultAttributes.name);

    // 3. Determine dynamic display order from the most recent result tracking
    const latestResult = await db
      .select({ json: results.json })
      .from(results)
      .where(and(sql`${results.json} IS NOT NULL`, whereClause))
      .orderBy(desc(results.createdAt))
      .limit(50);

    type AttributeData = { attribute?: string; label?: string; name?: string; source?: string; value?: string | number; confidence?: number; timestamp?: number };
    let bestTrace: AttributeData[] = [];
    for (const res of latestResult) {
      const json = res.json as { attributes?: AttributeData[] };
      if (json && Array.isArray(json.attributes)) {
        if (json.attributes.length > bestTrace.length) {
          bestTrace = json.attributes;
        }
      }
    }

    const dynamicOrder = new Map<string, number>();
    bestTrace.forEach((attr: AttributeData, index: number) => {
      const name = attr.attribute || attr.label || attr.name || "Unknown";
      if (!dynamicOrder.has(name)) {
        dynamicOrder.set(name, index);
      }
    });

    let nextIndex = dynamicOrder.size;
    for (const res of latestResult) {
      const json = res.json as { attributes?: AttributeData[] };
      if (json && Array.isArray(json.attributes)) {
        json.attributes.forEach((attr: AttributeData) => {
          const name = attr.attribute || attr.label || attr.name || "Unknown";
          if (!dynamicOrder.has(name)) {
            dynamicOrder.set(name, nextIndex++);
          }
        });
      }
    }

    const formatPercent = (correct: unknown, total: unknown) => 
      Number(total) > 0 ? Math.round((Number(correct) / Number(total)) * 100) : 0;

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
          originalName: attr.name,
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
      }).map(({ name, accuracy, correct, incorrect, unmarked, totalTraces }) => ({ name, accuracy, correct, incorrect, unmarked, totalTraces }))
    });

  } catch (error) {
    console.error("Dashboard stats failed:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
