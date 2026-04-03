import { getCurrentUserServerAction } from "@/app/actions/current-user";
import { db } from "@/lib/db";
import { resultAttributes, results, users } from "@/lib/db/schema";
import { and, eq, sql, count, gte, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { fromZonedTime } from "date-fns-tz";

export async function GET(req: Request) {
  try {
    const currentUser = await getCurrentUserServerAction();
    if (!currentUser || currentUser.role !== "power_user") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const timezone = searchParams.get("timezone") || "UTC";

    const filters = [];
    if (startDate) {
      const startDateTime = fromZonedTime(`${startDate}T00:00:00`, timezone);
      filters.push(gte(results.createdAt, startDateTime));
    }
    if (endDate) {
      const endDateTime = fromZonedTime(`${endDate}T23:59:59.999`, timezone);
      filters.push(lte(results.createdAt, endDateTime));
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const userStats = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        totalTraces: count(sql`distinct ${results.id}`),
        totalAttributes: count(resultAttributes.id),
        correct: sql`count(case when ${resultAttributes.status} = 'correct' then 1 end)`,
        incorrect: sql`count(case when ${resultAttributes.status} = 'incorrect' then 1 end)`,
        unmarked: sql`count(case when ${resultAttributes.status} = 'unmarked' then 1 end)`,
      })
      .from(users)
      .leftJoin(results, eq(users.id, results.createdByUserId))
      .leftJoin(resultAttributes, eq(results.id, resultAttributes.resultId))
      .where(whereClause)
      .groupBy(users.id, users.name, users.email)
      .orderBy(desc => sql`count(distinct ${results.id}) DESC`);

    const formattedStats = userStats.map(stat => {
      const total = Number(stat.totalAttributes);
      const correct = Number(stat.correct);
      const incorrect = Number(stat.incorrect);
      // Accuracy in this context means Completion %: (Correct + Incorrect) / Total
      const accuracy = total > 0 ? Math.round(((correct + incorrect) / total) * 100) : 0;

      return {
        id: stat.id,
        name: stat.name,
        email: stat.email,
        accuracy,
        correct: Number(stat.correct),
        incorrect: Number(stat.incorrect),
        unmarked: Number(stat.unmarked),
        totalTraces: Number(stat.totalTraces)
      };
    });

    return NextResponse.json(formattedStats, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=59'
      }
    });

  } catch (error) {
    console.error("User stats failed:", error);
    return NextResponse.json({ error: "Failed to fetch user stats" }, { status: 500 });
  }
}
