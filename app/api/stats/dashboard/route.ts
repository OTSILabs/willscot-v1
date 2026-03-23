import { db } from "@/lib/db";
import { resultAttributes } from "@/lib/db/schema";
import { eq, sql, avg, count } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // 1. Calculate overall, interior, and exterior averages
    // Note: We use 100 * (Number of Correct / Total Reviewed)
    const overallStats = await db
      .select({
        total: count(resultAttributes.id),
        correct: sql`count(case when ${resultAttributes.isCorrect} = true then 1 end)`,
      })
      .from(resultAttributes);

    const sourceStats = await db
      .select({
        source: resultAttributes.source,
        total: count(resultAttributes.id),
        correct: sql`count(case when ${resultAttributes.isCorrect} = true then 1 end)`,
      })
      .from(resultAttributes)
      .groupBy(resultAttributes.source);

    // 2. Calculate per-attribute accuracy
    const attributeStats = await db
      .select({
        name: resultAttributes.name,
        total: count(resultAttributes.id),
        correct: sql`count(case when ${resultAttributes.isCorrect} = true then 1 end)`,
      })
      .from(resultAttributes)
      .groupBy(resultAttributes.name);

    // Format the response for easy consumption by the dashboard
    const formatPercent = (correct: any, total: any) => 
      total > 0 ? Math.round((Number(correct) / Number(total)) * 100) : 0;

    const interior = sourceStats.find(s => s.source === 'interior');
    const exterior = sourceStats.find(s => s.source === 'exterior');

    return NextResponse.json({
      overview: {
        overall: formatPercent(overallStats[0].correct, overallStats[0].total),
        interior: formatPercent(interior?.correct, interior?.total),
        exterior: formatPercent(exterior?.correct, exterior?.total),
      },
      attributes: attributeStats.map(attr => ({
        name: attr.name,
        accuracy: formatPercent(attr.correct, attr.total),
        totalTraces: attr.total
      })).sort((a, b) => b.accuracy - a.accuracy)
    });

  } catch (error) {
    console.error("Dashboard stats failed:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
