import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Disable prefetch as it is not supported for "Transaction" pool mode
export const client = postgres(connectionString, {
  prepare: false,
  ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
});

export const db = drizzle(client, { schema });
