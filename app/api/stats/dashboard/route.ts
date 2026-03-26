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
    if (!currentUser || currentUser.role !== "power_user") {
      return NextResponse.json({ error: "Forbidden: Power User access required" }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const userIds = searchParams.getAll("userId").filter(id => id !== "all" && id !== "");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const timezone = searchParams.get("timezone") || "UTC";

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
      return name.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
    };

    const interior = sourceStats.find((s: any) => s.source === 'interior');
    const exterior = sourceStats.find((s: any) => s.source === 'exterior');

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
      attributes: attributeStats.map((attr: any) => {
        const reviewed = Number(attr.total) - Number(attr.unmarked);
        return {
          name: formatAttributeName(attr.name),
          accuracy: formatPercent(attr.correct, reviewed),
          correct: attr.correct,
          incorrect: attr.incorrect,
          unmarked: attr.unmarked,
          totalTraces: attr.total
        };
      })
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
