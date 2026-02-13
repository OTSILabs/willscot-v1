import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createHash } from "crypto";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Disable prefetch as it is not supported for "Transaction" pool mode
export const client = postgres(connectionString, {
  prepare: false,
  ssl: { rejectUnauthorized: false },
});
export const db = drizzle(client, { schema });

async function ensureDefaultRootUser() {
  const rootPassword = process.env.ROOT_USER_PASSWORD || "root123";
  const rootPasswordHash = createHash("md5").update(rootPassword).digest("hex");

  await db
    .insert(schema.users)
    .values({
      name: "Admin related",
      email: "root@willscot.local",
      passwordHash: rootPasswordHash,
      role: "power_user",
    })
    .onConflictDoUpdate({
      target: schema.users.email,
      set: {
        name: "Admin related",
        passwordHash: rootPasswordHash,
        role: "power_user",
      },
    });
}

void ensureDefaultRootUser().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Failed to ensure default root user:", message);
});
