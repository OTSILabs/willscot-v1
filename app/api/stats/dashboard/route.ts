import { getCurrentUserServerAction } from "@/app/actions/current-user";
import { db } from "@/lib/db";
import { resultAttributes, results } from "@/lib/db/schema";
import { and, eq, sql, count, desc, gte, lte, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { fromZonedTime } from "date-fns-tz";
import { syncResultAttributes } from "@/lib/db/sync";
import { getAttributeOrder, PRETTY_NAME_MAP } from "@/lib/constants";
import { humanizeString } from "@/lib/utils";
import { getDateRangeFilters } from "@/lib/db/filters";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    const filters = getDateRangeFilters(startDate, endDate, timezone);
    if (userIds.length > 0) {
      filters.push(inArray(results.createdByUserId, userIds));
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

    // --- Optimized: Single Pass Aggregation ---
    // Instead of 3 scans, we perform 1 scan grouped by name/source and aggregate the rest in JS.
    const attributeStats = await getStatsBase(
      db
        .select({
          name: resultAttributes.name,
          source: resultAttributes.source,
          total: count(resultAttributes.id),
          correct: sql`count(case when ${resultAttributes.status} = 'correct' then 1 end)`,
          incorrect: sql`count(case when ${resultAttributes.status} = 'incorrect' then 1 end)`,
          unmarked: sql`count(case when ${resultAttributes.status} = 'unmarked' then 1 end)`,
          resultId: resultAttributes.resultId,
          orderIndex: sql<number>`min(${resultAttributes.orderIndex})`,
        })
        .from(resultAttributes)
    )
      .groupBy(resultAttributes.name, resultAttributes.source, resultAttributes.resultId)
      .orderBy(sql`min(${resultAttributes.orderIndex})`);

    const formatAccuracy = (correct: number | string, incorrect: number | string) => {
      const c = Number(correct);
      const i = Number(incorrect);
      const denominator = c + i;
      return denominator > 0 ? Math.round((c / denominator) * 100) : 0;
    };

    // --- High Speed JS Aggregation and Deduplication ---
    const summaryData = {
      overall: { total: new Set<string>(), correct: new Set<string>(), incorrect: new Set<string>(), unmarked: new Set<string>(), correctCount: 0, incorrectCount: 0 },
      interior: { total: new Set<string>(), correct: new Set<string>(), incorrect: new Set<string>(), unmarked: new Set<string>(), correctCount: 0, incorrectCount: 0 },
      exterior: { total: new Set<string>(), correct: new Set<string>(), incorrect: new Set<string>(), unmarked: new Set<string>(), correctCount: 0, incorrectCount: 0 },
    };

    /**
     * Creates a canonical key for aggregation by removing all spacers and forcing lowercase.
     * This ensures "Exterior Color", "exterior_color", and "exteriorcolor" all merge.
     */
    const getCanonicalKey = (name: string) => {
      return name.toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    // Use a Map to aggregate stats by humanized name and track unique trace IDs
    const attributeMap = new Map<string, {
      name: string;
      correctTraceIds: Set<string>;
      incorrectTraceIds: Set<string>;
      unmarkedTraceIds: Set<string>;
      totalTraceIds: Set<string>;
    }>();

    attributeStats.forEach((attr: any) => {
      const resultId = attr.resultId;
      const rawName = attr.name || "Unknown";
      
      const canonicalKey = getCanonicalKey(rawName);
      const humanizedName = humanizeString(rawName);
      
      // CRITICAL: Use the canonical key to ensure all variants (spacing/casing) merge
      if (!attributeMap.has(canonicalKey)) {
        // Preference: Use the MASTER list's pretty name if found, otherwise humanize our first encounter
        const displayName = PRETTY_NAME_MAP.get(canonicalKey) || humanizedName;
        
        attributeMap.set(canonicalKey, {
          name: displayName,
          correctTraceIds: new Set(),
          incorrectTraceIds: new Set(),
          unmarkedTraceIds: new Set(),
          totalTraceIds: new Set(),
        });
      }
      
      const entry = attributeMap.get(canonicalKey)!;
      
      // Update the display name if we have a "better" one (has spaces) and we haven't found a MASTER match yet
      if (!PRETTY_NAME_MAP.has(canonicalKey) && humanizedName.includes(' ') && !entry.name.includes(' ')) {
        entry.name = humanizedName;
      }
      entry.totalTraceIds.add(resultId);
      
      if (Number(attr.correct) > 0) entry.correctTraceIds.add(resultId);
      if (Number(attr.incorrect) > 0) entry.incorrectTraceIds.add(resultId);
      if (Number(attr.unmarked) > 0) entry.unmarkedTraceIds.add(resultId);

      // Update summary unique trace tracking
      summaryData.overall.total.add(resultId);
      if (Number(attr.correct) > 0) summaryData.overall.correct.add(resultId);
      if (Number(attr.incorrect) > 0) summaryData.overall.incorrect.add(resultId);
      if (Number(attr.unmarked) > 0) summaryData.overall.unmarked.add(resultId);
      
      // Update raw instance counts for overall performance metrics
      summaryData.overall.correctCount += Number(attr.correct);
      summaryData.overall.incorrectCount += Number(attr.incorrect);

      if (attr.source === 'interior' || attr.source === 'exterior') {
        const target = attr.source === 'interior' ? summaryData.interior : summaryData.exterior;
        target.total.add(resultId);
        if (Number(attr.correct) > 0) target.correct.add(resultId);
        if (Number(attr.incorrect) > 0) target.incorrect.add(resultId);
        if (Number(attr.unmarked) > 0) target.unmarked.add(resultId);
        
        target.correctCount += Number(attr.correct);
        target.incorrectCount += Number(attr.incorrect);
      }
    });

    const summary = {
      overall: {
        total: summaryData.overall.total.size,
        correct: summaryData.overall.correct.size,
        incorrect: summaryData.overall.incorrect.size,
        unmarked: summaryData.overall.unmarked.size,
        accuracy: formatAccuracy(summaryData.overall.correctCount, summaryData.overall.incorrectCount)
      },
      interior: {
        total: summaryData.interior.total.size,
        correct: summaryData.interior.correct.size,
        incorrect: summaryData.interior.incorrect.size,
        unmarked: summaryData.interior.unmarked.size,
        accuracy: formatAccuracy(summaryData.interior.correctCount, summaryData.interior.incorrectCount)
      },
      exterior: {
        total: summaryData.exterior.total.size,
        correct: summaryData.exterior.correct.size,
        incorrect: summaryData.exterior.incorrect.size,
        unmarked: summaryData.exterior.unmarked.size,
        accuracy: formatAccuracy(summaryData.exterior.correctCount, summaryData.exterior.incorrectCount)
      }
    };

    const attributes = Array.from(attributeMap.values())
      .map(attr => ({
        name: attr.name,
        correct: attr.correctTraceIds.size,
        incorrect: attr.incorrectTraceIds.size,
        unmarked: attr.unmarkedTraceIds.size,
        totalTraces: attr.totalTraceIds.size,
        accuracy: formatAccuracy(attr.correctTraceIds.size, attr.incorrectTraceIds.size)
      }))
      .sort((a: any, b: any) => getAttributeOrder(a.name) - getAttributeOrder(b.name));

    return NextResponse.json({
      overview: {
        overall: {
          ...summary.overall
        },
        interior: {
          ...summary.interior
        },
        exterior: {
          ...summary.exterior
        },
      },
      attributes
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });

  } catch (error) {
    console.error("Dashboard stats failed:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
