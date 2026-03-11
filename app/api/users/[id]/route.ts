import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";
import { NextResponse } from "next/server";

const ALLOWED_ROLES = ["power_user", "normal_user"] as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const name = body?.name === undefined ? undefined : String(body.name).trim();
    const email =
      body?.email === undefined
        ? undefined
        : String(body.email).trim().toLowerCase();
    const role = body?.role === undefined ? undefined : String(body.role);
    const password =
      body?.password === undefined ? undefined : String(body.password);

    if (role && !ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const values: {
      name?: string;
      email?: string;
      role?: "power_user" | "normal_user";
      passwordHash?: string;
    } = {};

    if (name !== undefined) values.name = name;
    if (email !== undefined) values.email = email;
    if (role !== undefined) values.role = role as "power_user" | "normal_user";
    if (password !== undefined && password.trim().length > 0) {
      const newPasswordHash = createHash("md5").update(password).digest("hex");

      // Check if the new password is the same as the current password
      const [existingUser] = await db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, id));

      if (existingUser && existingUser.passwordHash === newPasswordHash) {
        return NextResponse.json(
          { error: "New password cannot be the same as the current password" },
          { status: 400 }
        );
      }

      values.passwordHash = newPasswordHash;
    }

    if (Object.keys(values).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const [updated] = await db
      .update(users)
      .set(values)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      });

    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to update user:", errorMessage);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const [deleted] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
      });

    if (!deleted) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to delete user:", errorMessage);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}

