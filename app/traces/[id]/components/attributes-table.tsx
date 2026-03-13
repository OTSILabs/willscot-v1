"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { humanizeString } from "@/lib/utils";

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
      <div className="hidden md:block">
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
                <TableCell>{humanizeString(attribute.pipeline)}</TableCell>
                <TableCell>{humanizeString(attribute.attribute)}</TableCell>
                <TableCell>{humanizeString(attribute.value)}</TableCell>
                <TableCell>{humanizeString(attribute.source)}</TableCell>
                <TableCell className="whitespace-normal wrap-break-word">
                  {humanizeString(attribute.evidence)}
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
      </div>

      {/* Mobile Card Layout */}
      <div className="md:hidden flex flex-col gap-4 pb-20">
        {attributes.map((attribute, index) => {
          const isLocked =
            attribute.status === "correct" || attribute.status === "wrong";

          return (
            <div key={index} className="flex flex-col gap-2 rounded-xl bg-card p-4 shadow-sm text-card-foreground">
              <div>
                <p className="text-xs font-medium text-muted-foreground pb-0.5">
                  {humanizeString(attribute.pipeline)} &gt; {humanizeString(attribute.attribute)}
                </p>
                <p className="font-semibold text-sm">
                  {humanizeString(attribute.value)}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({humanizeString(attribute.source)})
                  </span>
                </p>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed break-words whitespace-normal py-1">
                {humanizeString(attribute.evidence)}
              </p>

              <div className="flex items-center justify-end pt-2 border-t mt-1">
                {isLocked ? (
                  attribute.status === "correct" ? (
                    <span className="text-green-600 font-medium text-sm flex items-center gap-1">
                      <CheckIcon className="w-4 h-4" /> Marked Correct
                    </span>
                  ) : (
                    <div className="text-sm text-right">
                      <p className="text-red-600 font-medium flex items-center justify-end gap-1">
                        <XIcon className="w-4 h-4" /> Marked Wrong
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{attribute.feedback}</p>
                    </div>
                  )
                ) : (
                  <ButtonGroup>
                    <ButtonGroupText className="text-xs font-medium px-3">
                      Verify
                    </ButtonGroupText>
                    <Button
                      size="sm"
                      title="Mark as Correct"
                      className="bg-green-600 text-white hover:bg-green-700 h-8 px-3"
                      onClick={() => handleCorrectClick(index)}
                    >
                      <CheckIcon className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      title="Mark as Wrong"
                      className="h-8 px-3"
                      onClick={() => handleWrongClick(index)}
                    >
                      <XIcon className="w-4 h-4" />
                    </Button>
                  </ButtonGroup>
                )}
              </div>
            </div>
          );
        })}
      </div>

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