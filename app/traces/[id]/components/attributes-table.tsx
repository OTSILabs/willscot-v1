"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { TraceAttribute } from "./types";
import { CheckIcon, XIcon } from "lucide-react";
import { FeedbackDialog, FeedbackFormValues } from "./feedback-dialog";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";

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

export function AttributesTable({ attributes, onAttributeUpdate }: AttributesTableProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"correct" | "wrong" | null>(null);
  const [dialogStep, setDialogStep] = useState<"input" | "confirm">("input");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const resetDialog = () => {
    setDialogOpen(false);
  };

  const handleCorrectClick = (index: number) => {
    setDialogMode("correct");
    setSelectedIndex(index);
    setDialogStep("confirm");
    setDialogOpen(true);
  };

  const handleWrongClick = (index: number) => {
    setDialogMode("wrong");
    setSelectedIndex(index);
    setDialogStep("input");
    setDialogOpen(true);
  };

  const handleFinalSave = (data: FeedbackFormValues | undefined) => {
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
        feedback: data?.feedback,
        status: "wrong",
      });

      toast.success("Feedback saved");
    }

    resetDialog();
  };

  return (
    <>
      <Table className="text-xs table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>Property</TableHead>
            <TableHead>Attribute</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="w-[40%]">Evidence</TableHead>
            <TableHead className="w-[25%]">Feedback</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody className="[&_td]:whitespace-normal">
          {attributes.map((attribute, index) => {
            const isLocked =
              attribute.status === "correct" || attribute.status === "wrong";

            return (
              <TableRow key={index}>
                <TableCell>{toTitleCase(attribute.pipeline)}</TableCell>
                <TableCell>{toTitleCase(attribute.attribute)}</TableCell>
                <TableCell>{formatMeta(attribute.value)}</TableCell>
                <TableCell>{formatMeta(attribute.source)}</TableCell>
                <TableCell className="whitespace-normal wrap-break-word">
                  {formatMeta(attribute.evidence)}
                </TableCell>

                <TableCell>
                  {isLocked ? (
                    attribute.status === "correct" ? (
                      <span className="text-green-600 font-medium text-xs">
                        Marked Correct
                      </span>
                    ) : (
                      <div className="text-xs">
                        <p className="text-red-600">Marked Wrong:</p>
                        <p>{attribute.feedback}</p>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center gap-2 justify-center">
                      <ButtonGroup>
                        <ButtonGroupText className="text-xs">
                          Verify
                        </ButtonGroupText>
                        <Button
                          size="xs"
                          title="Mark as Correct"
                          className="bg-green-600 text-white hover:bg-green-700"
                          onClick={() => handleCorrectClick(index)}
                        >
                          <CheckIcon />
                        </Button>

                        <Button
                          size="xs"
                          title="Mark as Wrong"
                          onClick={() => handleWrongClick(index)}
                        >
                          <XIcon />
                        </Button>
                      </ButtonGroup>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <FeedbackDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) resetDialog();
        }}
        dialogMode={dialogMode}
        dialogStep={dialogStep}
        onFinalSave={handleFinalSave}
        onCancel={resetDialog}
      />
    </>
  );
}