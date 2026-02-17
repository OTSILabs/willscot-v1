"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export interface ServerCurrentUser {
  id: string;
  name: string;
  email: string;
  role: "power_user" | "normal_user";
}

export async function getCurrentUserServerAction(): Promise<ServerCurrentUser | null> {
  try {
    const cookieStore = await cookies();
    const email = cookieStore.get("auth_user")?.value;

    if (!email) {
      return null;
    }

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user ?? null;
  } catch {
    return null;
  }
}

