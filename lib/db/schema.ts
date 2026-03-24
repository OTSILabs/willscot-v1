import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  doublePrecision,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["power_user", "normal_user"]);
export const feedbackStatusEnum = pgEnum("feedback_status", ["unmarked", "correct", "incorrect"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").default("normal_user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const results = pgTable("results", {
  id: uuid("id").primaryKey().defaultRandom(),
  videoId: text("video_id").notNull(),
  status: text("status").notNull(),
  containerType: text("container_type"),
  model: text("model"),
  regionName: text("region_name"),
  videoName: text("video_name"),
  customId: text("custom_id").unique(),
  json: jsonb("json").notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const resultAttributes = pgTable("result_attributes", {
  id: uuid("id").primaryKey().defaultRandom(),
  resultId: uuid("result_id").references(() => results.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(), // e.g., "Container Number"
  source: text("source").notNull(), // "interior" or "exterior"
  value: text("value"),
  status: feedbackStatusEnum("status").default("unmarked").notNull(),
  confidence: doublePrecision("confidence"),
  timestamp: doublePrecision("timestamp"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
