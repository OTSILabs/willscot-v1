import { pgTable, unique, uuid, text, timestamp, foreignKey, jsonb, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const userRole = pgEnum("user_role", ['power_user', 'normal_user'])


export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	role: userRole().default('normal_user').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const results = pgTable("results", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	videoId: text("video_id").notNull(),
	status: text().notNull(),
	json: jsonb().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	createdByUserId: uuid("created_by_user_id"),
	containerType: text("container_type"),
	model: text(),
	regionName: text("region_name"),
}, (table) => [
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [users.id],
			name: "results_created_by_user_id_users_id_fk"
		}).onDelete("set null"),
]);
