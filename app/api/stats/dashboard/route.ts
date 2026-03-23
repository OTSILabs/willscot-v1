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

    // Format the response for easy consumption by the dashboard
    const formatPercent = (correct: any, total: any) => 
      total > 0 ? Math.round((Number(correct) / Number(total)) * 100) : 0;

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
          name: attr.name,
          accuracy: formatPercent(attr.correct, reviewed),
          correct: attr.correct,
          incorrect: attr.incorrect,
          unmarked: attr.unmarked,
          totalTraces: attr.total
        };
      }).sort((a, b) => (b.accuracy as number) - (a.accuracy as number))
    });

  } catch (error) {
    console.error("Dashboard stats failed:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
