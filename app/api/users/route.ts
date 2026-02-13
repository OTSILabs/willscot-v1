import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { desc, ilike, or, sql } from "drizzle-orm";
import { createHash } from "crypto";
import { NextResponse } from "next/server";

const ALLOWED_ROLES = ["power_user", "normal_user"] as const;

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

    const filter = or(
      ilike(users.name, `%${search}%`),
      ilike(users.email, `%${search}%`),
    );

    const [totalRow] = search
      ? await db.select({ count: sql<number>`count(*)` }).from(users).where(filter)
      : await db.select({ count: sql<number>`count(*)` }).from(users);
    const total = Number(totalRow?.count ?? 0);

    const items = search
      ? await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(filter)
          .orderBy(desc(users.createdAt))
          .limit(pageSize)
          .offset(offset)
      : await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            createdAt: users.createdAt,
          })
          .from(users)
          .orderBy(desc(users.createdAt))
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
    console.error("Failed to fetch users:", errorMessage);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const role = String(body?.role || "normal_user");

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email and password are required" },
        { status: 400 },
      );
    }

    if (!ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const passwordHash = createHash("md5").update(password).digest("hex");

    const [created] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash,
        role: role as "power_user" | "normal_user",
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      });

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to create user:", errorMessage);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

