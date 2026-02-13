import { db } from "@/lib/db";
import { results, users } from "@/lib/db/schema";
import { desc, eq, ilike, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pageParam = Number(searchParams.get("page") || 1);
    const pageSizeParam = Number(searchParams.get("pageSize") || 10);
    const search = (searchParams.get("search") || "").trim();
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const pageSize =
      Number.isFinite(pageSizeParam) && pageSizeParam > 0
        ? Math.min(pageSizeParam, 50)
        : 10;
    const offset = (page - 1) * pageSize;

    const [totalRow] = search
      ? await db
          .select({ count: sql<number>`count(*)` })
          .from(results)
          .where(ilike(results.videoId, `%${search}%`))
      : await db
          .select({ count: sql<number>`count(*)` })
          .from(results);
    const total = Number(totalRow?.count ?? 0);

    const items = search
      ? await db
          .select({
            id: results.id,
            videoId: results.videoId,
            status: results.status,
            createdByUserId: results.createdByUserId,
            createdByName: users.name,
            createdByEmail: users.email,
            createdAt: results.createdAt,
          })
          .from(results)
          .leftJoin(users, eq(results.createdByUserId, users.id))
          .where(ilike(results.videoId, `%${search}%`))
          .orderBy(desc(results.createdAt))
          .limit(pageSize)
          .offset(offset)
      : await db
          .select({
            id: results.id,
            videoId: results.videoId,
            status: results.status,
            createdByUserId: results.createdByUserId,
            createdByName: users.name,
            createdByEmail: users.email,
            createdAt: results.createdAt,
          })
          .from(results)
          .leftJoin(users, eq(results.createdByUserId, users.id))
          .orderBy(desc(results.createdAt))
          .limit(pageSize)
          .offset(offset);

    return NextResponse.json({
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching results:", errorMessage);
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 },
    );
  }
}
