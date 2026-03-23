import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { createHash } from "crypto";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    const passwordHash = createHash("md5").update(password).digest("hex");

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(and(eq(users.email, email), eq(users.passwordHash, passwordHash)))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const response = NextResponse.json({ user });
    
    // Use manual header to include 'Partitioned' for CHIPS support in iframes
    const maxAge = 60 * 60 * 24 * 7;
    response.headers.append(
      "Set-Cookie", 
      `auth_user=${user.email}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${maxAge}`
    );
    
    return response;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Login failed:", errorMessage);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

