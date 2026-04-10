import { results } from "./schema";
import { and, gte, lte } from "drizzle-orm";
import { fromZonedTime } from "date-fns-tz";

/**
 * Generates Drizzle filter expressions for a date range based on a user's local timezone.
 * Standardizes time boundaries to 00:00:00 and 23:59:59.
 */
export function getDateRangeFilters(
  startDate: string | null,
  endDate: string | null,
  timezone: string = "UTC"
) {
  const filters = [];

  if (startDate) {
    // Start of the day in the user's timezone, converted to UTC
    const startDateTime = fromZonedTime(`${startDate}T00:00:00`, timezone);
    filters.push(gte(results.createdAt, startDateTime));
  }

  if (endDate) {
    // End of the day in the user's timezone, converted to UTC
    const endDateTime = fromZonedTime(`${endDate}T23:59:59.999`, timezone);
    filters.push(lte(results.createdAt, endDateTime));
  }

  return filters;
}
