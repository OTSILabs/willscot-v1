import { getCurrentUserServerAction } from "@/app/actions/current-user";
import { db } from "@/lib/db";
import { results, users } from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const currentUser = await getCurrentUserServerAction();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const filter = currentUser.role === "power_user" ? undefined : eq(results.createdByUserId, currentUser.id);

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
        .where(
          and(
            filter,
            sql`(${results.videoId} ILIKE ${`%${search}%`} OR ${results.videoName} ILIKE ${`%${search}%`} OR ${results.customId} ILIKE ${`%${search}%`})`
          )
        )
      : await db
        .select({ count: sql<number>`count(*)` })
        .from(results)
        .where(filter);
    const total = Number(totalRow?.count ?? 0);

    const items = search
      ? await db
        .select({
          id: results.id,
          videoId: results.videoId,
          videoName: results.videoName,
          customId: results.customId,
          status: results.status,
          containerType: results.containerType,
          model: results.model,
          regionName: results.regionName,
          createdByUserId: results.createdByUserId,
          createdByName: users.name,
          createdByEmail: users.email,
          createdAt: results.createdAt,
          json: results.json,
        })
        .from(results)
        .leftJoin(users, eq(results.createdByUserId, users.id))
        .where(
          and(
            filter,
            sql`(${results.videoId} ILIKE ${`%${search}%`} OR ${results.videoName} ILIKE ${`%${search}%`} OR ${results.customId} ILIKE ${`%${search}%`})`
          )
        )
        .orderBy(desc(results.createdAt))
        .limit(pageSize)
        .offset(offset)
      : await db
        .select({
          id: results.id,
          videoId: results.videoId,
          videoName: results.videoName,
          customId: results.customId,
          status: results.status,
          containerType: results.containerType,
          model: results.model,
          regionName: results.regionName,
          createdByUserId: results.createdByUserId,
          createdByName: users.name,
          createdByEmail: users.email,
          createdAt: results.createdAt,
          json: results.json,
        })
        .from(results)
        .leftJoin(users, eq(results.createdByUserId, users.id))
        .where(filter)
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
