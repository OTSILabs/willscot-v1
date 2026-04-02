import { getCurrentUserServerAction } from "@/app/actions/current-user";
import { db } from "@/lib/db";
import { resultAttributes, results } from "@/lib/db/schema";
import { and, eq, sql, count, desc, gte, lte, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { fromZonedTime } from "date-fns-tz";
import { syncResultAttributes } from "@/lib/db/sync";

export async function GET(req: Request) {
  try {
    const currentUser = await getCurrentUserServerAction();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawUserIds = searchParams.getAll("userId").filter(id => id !== "all" && id !== "");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const timezone = searchParams.get("timezone") || "UTC";

    // DATA ISOLATION: Normal users can only see their own statistics
    const userIds = currentUser.role === "power_user" ? rawUserIds : [currentUser.id];

    const filters = [];
    if (userIds.length > 0) {
      filters.push(inArray(results.createdByUserId, userIds));
    }
    
    // Optimized: Pre-calculate UTC date ranges in JS instead of calling DATE() in SQL.
    // We use date-fns-tz to ensure the boundaries are correct for the user's timezone.
    if (startDate) {
      // Start of the day in the user's timezone, converted to UTC
      const startDateTime = fromZonedTime(`${startDate}T00:00:00`, timezone);
      filters.push(gte(results.createdAt, startDateTime));
    }
    if (endDate) {
      // End of the day in the user's timezone, converted to UTC
      const endDateTime = fromZonedTime(`${endDate}T23:59:59.999`, timezone);
      filters.push(lte(results.createdAt, endDateTime));
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    // --- Optimized: Conditional Joins and Parallel Execution ---
    // If no filters are active, we can skip joining with the 'results' table entirely.
    const getStatsBase = (baseQuery: any) => {
      if (whereClause) {
        return baseQuery.innerJoin(results, eq(resultAttributes.resultId, results.id)).where(whereClause);
      }
      return baseQuery;
    };

    const [overallStats, sourceStats, attributeStats] = await Promise.all([
      getStatsBase(
        db
          .select({
            total: count(resultAttributes.id),
            correct: sql`count(case when ${resultAttributes.status} = 'correct' then 1 end)`,
            incorrect: sql`count(case when ${resultAttributes.status} = 'incorrect' then 1 end)`,
            unmarked: sql`count(case when ${resultAttributes.status} = 'unmarked' then 1 end)`,
          })
          .from(resultAttributes)
      ),

      getStatsBase(
        db
          .select({
            source: resultAttributes.source,
            total: count(resultAttributes.id),
            correct: sql`count(case when ${resultAttributes.status} = 'correct' then 1 end)`,
            incorrect: sql`count(case when ${resultAttributes.status} = 'incorrect' then 1 end)`,
            unmarked: sql`count(case when ${resultAttributes.status} = 'unmarked' then 1 end)`,
          })
          .from(resultAttributes)
      ).groupBy(resultAttributes.source),

      getStatsBase(
        db
          .select({
            name: resultAttributes.name,
            total: count(resultAttributes.id),
            correct: sql`count(case when ${resultAttributes.status} = 'correct' then 1 end)`,
            incorrect: sql`count(case when ${resultAttributes.status} = 'incorrect' then 1 end)`,
            unmarked: sql`count(case when ${resultAttributes.status} = 'unmarked' then 1 end)`,
            orderIndex: sql<number>`min(${resultAttributes.orderIndex})`,
          })
          .from(resultAttributes)
      )
        .groupBy(resultAttributes.name)
        .orderBy(sql`min(${resultAttributes.orderIndex})`),
    ]); 

    // REMOVED backgroundSync from here -> it's too expensive for a dashboard stats request.
    // Syncing is handled by the Trace Details page and Process Batch logic.


    const formatPercent = (correct: unknown, total: unknown) => 
      Number(total) > 0 ? Math.round((Number(correct) / Number(total)) * 100) : 0;

    const formatAttributeName = (name: string) => {
      return name
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .trim();
    };

    const MASTER_ATTRIBUTE_ORDER = [
      "Flooring", "Frame Type", "Exterior Color", "Exterior Finish", "Exterior Door", 
      "Windows", "Interior Finish", "Interior Door", "Roof Design", "Ceiling Type", 
      "Ceiling Height", "Restroom", "Restroom Water Closet", "Restroom Lavatory", 
      "Restroom Shower", "Electrical Electric Board", "Electrical Load Center", 
      "Electrical Lighting", "Emergency Exit Lighting", "Wiring", "Accessories", "Hvac"
    ];

    const getOrderPriority = (name: string) => {
      const index = MASTER_ATTRIBUTE_ORDER.indexOf(name);
      return index === -1 ? 999 : index;
    };

    const interior = sourceStats.find((s: any) => s.source === 'interior');
    const exterior = sourceStats.find((s: any) => s.source === 'exterior');

    const attributes = attributeStats
      .map((attr: any) => ({
        name: formatAttributeName(attr.name),
        accuracy: formatPercent(attr.correct, attr.total),
        correct: attr.correct,
        incorrect: attr.incorrect,
        unmarked: attr.unmarked,
        totalTraces: attr.total
      }))
      .sort((a: any, b: any) => getOrderPriority(a.name) - getOrderPriority(b.name));

    return NextResponse.json({
      overview: {
        overall: {
          accuracy: formatPercent(overallStats[0].correct, overallStats[0].total),
          correct: overallStats[0].correct,
          incorrect: overallStats[0].incorrect,
          unmarked: overallStats[0].unmarked,
          total: overallStats[0].total
        },
        interior: {
          accuracy: formatPercent(interior?.correct, interior?.total || 0),
          correct: interior?.correct || 0,
          incorrect: interior?.incorrect || 0,
          unmarked: interior?.unmarked || 0,
        },
        exterior: {
          accuracy: formatPercent(exterior?.correct, exterior?.total || 0),
          correct: exterior?.correct || 0,
          incorrect: exterior?.incorrect || 0,
          unmarked: exterior?.unmarked || 0,
        },
      },
      attributes
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=59'
      }
    });

  } catch (error) {
    console.error("Dashboard stats failed:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
