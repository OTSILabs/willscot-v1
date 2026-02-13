"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TraceAttribute } from "./types";

interface AttributesTableProps {
  attributes: TraceAttribute[];
  onFrameClick: (attribute: TraceAttribute) => void;
}

function formatMeta(value?: string | null) {
  if (!value || value.trim().length === 0) return "N/A";
  return value;
}

function toTitleCase(value?: string | null) {
  const raw = formatMeta(value);
  if (raw === "N/A") return "NA";

  return raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function hasMeaningfulValue(value?: string | null) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && !["na", "n/a", "none", "null"].includes(normalized);
}

export function AttributesTable({ attributes, onFrameClick }: AttributesTableProps) {
  const sortedAttributes = useMemo(() => {
    return [...attributes].sort((a, b) => {
      const aHasAttribute = hasMeaningfulValue(a.attribute);
      const bHasAttribute = hasMeaningfulValue(b.attribute);
      const aHasValue = hasMeaningfulValue(a.value);
      const bHasValue = hasMeaningfulValue(b.value);

      const aScore = Number(aHasAttribute) + Number(aHasValue);
      const bScore = Number(bHasAttribute) + Number(bHasValue);

      if (bScore !== aScore) return bScore - aScore;
      return 0;
    });
  }, [attributes]);

  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow>
          <TableHead>Property</TableHead>
          <TableHead>Attribute</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Evidence</TableHead>
          <TableHead className="w-24">Frame</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {attributes.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground">
              No attributes found in response.
            </TableCell>
          </TableRow>
        ) : (
          sortedAttributes.map((attribute, index) => {
            const second = Number(attribute.timestamp_seconds ?? 0);
            const hasFrame = Boolean(attribute.frame_s3_uri_url);

            return (
              <TableRow key={`${attribute.pipeline}-${attribute.attribute}-${index}`}>
                <TableCell>{toTitleCase(attribute.pipeline)}</TableCell>
                <TableCell>{toTitleCase(attribute.attribute)}</TableCell>
                <TableCell>{formatMeta(attribute.value)}</TableCell>
                <TableCell className="max-w-[320px] whitespace-normal wrap-break-word">
                  {formatMeta(attribute.evidence)}
                </TableCell>
                <TableCell>
                  {hasFrame ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onFrameClick(attribute)}
                    >
                      {second}s
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-xs">N/A</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

