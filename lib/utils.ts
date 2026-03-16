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
export function humanizeString(s: string | null | undefined) {
  if (!s || s.trim().length === 0) return "N/A";
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function extractFilenames(videoId: string | null | undefined) {
  if (!videoId) return "";
  return videoId
    .split(",")
    .map((uri) => {
      const parts = uri.split("/");
      let lastPart = parts[parts.length - 1] || "";
      
      // Smart Cleaning:
      // 1. Remove leading timestamp (digits followed by underscore)
      lastPart = lastPart.replace(/^\d+_/, "");
      
      // 2. Remove file extension (last dot and everything following)
      lastPart = lastPart.replace(/\.[^/.]+$/, "");
      
      return lastPart || uri;
    })
    .join(",");
}
