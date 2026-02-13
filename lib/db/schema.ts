import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export const results = pgTable("results", {
  id: uuid("id").primaryKey().defaultRandom(),
  videoId: text("video_id").notNull(),
  status: text("status").notNull(),
  json: jsonb("json").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
