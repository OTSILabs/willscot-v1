import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatInTimeZone } from "date-fns-tz";
import { PRETTY_NAME_MAP, normalizeAttributeName } from "./constants";

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
  
  // 1. Check if we have a predefined "Pretty Name" in our master list
  const normalized = normalizeAttributeName(s);
  const prettyMatch = PRETTY_NAME_MAP.get(normalized);
  if (prettyMatch) return prettyMatch;

  // 2. Fallback to generic humanization for unknown attributes
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

export function getPaginationRange(currentPage: number, totalPages: number) {
  const isBrowser = typeof window !== "undefined";
  const delta = (isBrowser && window.innerWidth < 768) ? 1 : 2; // Fewer neighbors on mobile
  const range = [];
  const rangeWithDots = [];
  let l;

  range.push(1);
  for (let i = currentPage - delta; i <= currentPage + delta; i++) {
    if (i < totalPages && i > 1) {
      range.push(i);
    }
  }
  if (totalPages > 1) {
    range.push(totalPages);
  }

  for (const i of range) {
    if (l) {
      if (i - l === 2) {
        rangeWithDots.push(l + 1);
      } else if (i - l !== 1) {
        rangeWithDots.push("...");
      }
    }
    rangeWithDots.push(i);
    l = i;
  }

  return rangeWithDots;
}
