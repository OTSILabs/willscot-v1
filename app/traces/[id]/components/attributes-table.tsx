"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  onAttributeUpdate: (index: number, newAttribute: TraceAttribute) => void;
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

export function AttributesTable({
  attributes,
  onAttributeUpdate,
}: AttributesTableProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"correct" | "wrong" | null>(null);
  const [dialogStep, setDialogStep] = useState<"input" | "confirm">("input");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [tempFeedback, setTempFeedback] = useState("");

  const sortedAttributes = useMemo(() => {
    return [...attributes].sort((a, b) => {
      const pipelineA = (a.pipeline || "").toLowerCase();
      const pipelineB = (b.pipeline || "").toLowerCase();

      if (pipelineA !== pipelineB) {
        return pipelineA.localeCompare(pipelineB);
      }

      return (a.attribute || "").localeCompare(b.attribute || "");
    });
  }, [attributes]);

  const resetDialog = () => {
    setDialogOpen(false);
    setDialogMode(null);
    setDialogStep("input");
    setSelectedIndex(null);
    setTempFeedback("");
  };

  const handleCorrectClick = (index: number) => {
    setDialogMode("correct");
    setSelectedIndex(index);
    setDialogStep("confirm");
    setDialogOpen(true);
  };

  const handleWrongClick = (attribute: TraceAttribute, index: number) => {
    setDialogMode("wrong");
    setSelectedIndex(index);
    setTempFeedback(attribute.feedback || "");
    setDialogStep("input");
    setDialogOpen(true);
  };

  const handleFinalSave = () => {
    if (selectedIndex === null || !dialogMode) return;

    const attribute = attributes[selectedIndex];

    if (dialogMode === "correct") {
      onAttributeUpdate(selectedIndex, {
        ...attribute,
        feedback: null,
        status: "correct",
      });

      toast.success("Marked as correct");
    }

    if (dialogMode === "wrong") {
      onAttributeUpdate(selectedIndex, {
        ...attribute,
        feedback: tempFeedback,
        status: "wrong",
      });

      toast.success("Feedback saved");
    }

    resetDialog();
  };

  return (
    <>
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>Property</TableHead>
            <TableHead>Attribute</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Feedback</TableHead>
            <TableHead>Evidence</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {sortedAttributes.map((attribute, index) => {
            const originalIndex = attributes.indexOf(attribute);

            const isLocked =
              attribute.status === "correct" ||
              attribute.status === "wrong";

            return (
              <TableRow key={index}>
                <TableCell>{toTitleCase(attribute.pipeline)}</TableCell>
                <TableCell>{toTitleCase(attribute.attribute)}</TableCell>
                <TableCell>{formatMeta(attribute.value)}</TableCell>

                <TableCell className="align-middle w-[260px]">
                  {isLocked ? (
                    attribute.status === "correct" ? (
                      <span className="text-green-600 font-medium text-xs">
                        Correct
                      </span>
                    ) : (
                      <div className=" rounded px-2 py-2 text-xs w-full">
                        <p className="font-semibold mb-1">Feedback</p>
                        <p className="break-words">{attribute.feedback}</p>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs bg-green-500/10 text-green-600 hover:bg-green-500/20 hover:text-green-700 border-green-200"
                        onClick={() => handleCorrectClick(originalIndex)}
                      >
                        Correct
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleWrongClick(attribute, originalIndex)}
                      >
                        Wrong
                      </Button>
                    </div>
                  )}
                </TableCell>


                <TableCell className="max-w-[320px] whitespace-normal break-words">
                  {formatMeta(attribute.evidence)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* ✅ DIALOG */}

      <Dialog open={dialogOpen} onOpenChange={resetDialog}>
        <DialogContent>
          {dialogMode === "wrong" && dialogStep === "input" && (
            <>
              <DialogHeader>
                <DialogTitle>Enter Expected Result</DialogTitle>
              </DialogHeader>

              <textarea
                value={tempFeedback}
                onChange={(e) => setTempFeedback(e.target.value)}
                placeholder="Enter expected result..."
                autoFocus
                className="min-h-[140px] text-sm resize-none "
              />


              <DialogFooter>
                <Button variant="outline" onClick={resetDialog}>
                  Cancel
                </Button>

                <Button
                  onClick={() => setDialogStep("confirm")}
                  disabled={!tempFeedback.trim()}
                >
                  Confirm
                </Button>
              </DialogFooter>
            </>
          )}

          {dialogStep === "confirm" && (
            <>
              <DialogHeader>
                <DialogTitle>Are you sure?</DialogTitle>
              </DialogHeader>

              {dialogMode === "correct" ? (
                <p className="text-sm text-muted-foreground">
                  Once you confirm, this will be marked as{" "}
                  <span className="font-semibold text-foreground">
                    Correct
                  </span>{" "}
                  and cannot be changed again.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    This expected result will be saved and locked.
                  </p>

                  <div className="rounded border bg-muted/40 p-2 border-l-4 border-l-orange-500 text-xs">
                    {tempFeedback}
                  </div>
                </>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={resetDialog}>
                  Cancel
                </Button>

                <Button onClick={handleFinalSave}>Confirm</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
