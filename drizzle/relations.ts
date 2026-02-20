import { relations } from "drizzle-orm/relations";
import { users, results } from "./schema";

export const resultsRelations = relations(results, ({one}) => ({
	user: one(users, {
		fields: [results.createdByUserId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	results: many(results),
}));