import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatInTimeZone } from "date-fns-tz";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function humanizeDateTime(date: string, format = "dd MMM yy, h:mm a") {
  if (!date) return null;

  const hasTimezone = /[Z\+\-]\d{2}:\d{2}$|Z$/.test(date);
  const dateString = hasTimezone ? date : date + "Z";
  const utcDate = new Date(dateString);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return formatInTimeZone(utcDate, tz, format);
}

export function humanizeFileSize(size: number) {
  const i = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
  return (
    (size / Math.pow(1024, i)).toFixed(2) +
    " " +
    ["B", "KB", "MB", "GB", "TB"][i]
  );
}
