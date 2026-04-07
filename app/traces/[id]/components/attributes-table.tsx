import React, { useState, useMemo } from "react";
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
import { CheckIcon, XIcon, PlayCircle } from "lucide-react";
import { FeedbackDialog, FeedbackFormValues } from "./feedback-dialog";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { TruncatedCell } from "@/components/common/truncated-cell";

interface AttributesTableProps {
  attributes: TraceAttribute[];
  onAttributeUpdate: (index: number, newAttribute: TraceAttribute) => void;
  onTimestampClick?: (timestamp: number, source: string) => void;
  isCompact?: boolean;
}

// Memoized helper to humanize strings with caching
const humanizeCache: Record<string, string> = {};
const fastHumanize = (str: string | null | undefined) => {
  if (!str) return "N/A";
  if (humanizeCache[str]) return humanizeCache[str];
  const result = humanizeString(str);
  humanizeCache[str] = result;
  return result;
};

const AttributeRow = React.memo(({ 
  attribute, 
  index, 
  isCompact, 
  onCorrect, 
  onWrong, 
  onTimestampClick 
}: {
  attribute: TraceAttribute;
  index: number;
  isCompact: boolean;
  onCorrect: (index: number) => void;
  onWrong: (index: number) => void;
  onTimestampClick?: (timestamp: number, source: string) => void;
}) => {
  const isLocked = attribute.status === "correct" || attribute.status === "incorrect";

  return (
    <TableRow>
      <TableCell>
        {isCompact ? (
          <TruncatedCell content={fastHumanize(attribute.pipeline)} maxW="max-w-[120px]" />
        ) : (
          <span className="whitespace-normal leading-normal">{fastHumanize(attribute.pipeline)}</span>
        )}
      </TableCell>
      <TableCell>
        {isCompact ? (
          <TruncatedCell content={fastHumanize(attribute.attribute)} maxW="max-w-[120px]" />
        ) : (
          <span className="whitespace-normal leading-normal">{fastHumanize(attribute.attribute)}</span>
        )}
      </TableCell>
      <TableCell>
        {isCompact ? (
          <TruncatedCell content={fastHumanize(attribute.value)} maxW="max-w-[150px]" />
        ) : (
          <span className="whitespace-normal leading-normal">{fastHumanize(attribute.value)}</span>
        )}
      </TableCell>
      <TableCell>
        {isCompact ? (
          <TruncatedCell content={fastHumanize(attribute.source)} maxW="max-w-[100px]" />
        ) : (
          <span className="whitespace-normal leading-normal">{fastHumanize(attribute.source)}</span>
        )}
      </TableCell>
      <TableCell>
        {isCompact ? (
          <TruncatedCell content={fastHumanize(attribute.evidence)} maxW="max-w-[200px]" />
        ) : (
          <span className="whitespace-normal leading-relaxed">{fastHumanize(attribute.evidence)}</span>
        )}
      </TableCell>

      <TableCell>
        <div className="flex flex-col gap-2">
          {attribute.timestamp_seconds !== null && attribute.timestamp_seconds !== undefined && (
            <button
              onClick={() => onTimestampClick?.(attribute.timestamp_seconds!, attribute.source || "interior")}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-800 transition-colors w-fit bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100"
            >
              <PlayCircle className="w-3 h-3" />
              {attribute.timestamp_seconds.toFixed(2)}s
            </button>
          )}
          
          {isLocked ? (
            attribute.status === "correct" ? (
              <span className="text-green-600 font-medium text-xs">
                Marked Correct
              </span>
            ) : (
              <div className="text-xs">
                <p className="text-red-600">Marked Incorrect:</p>
                <p className="line-clamp-2">{attribute.feedback}</p>
              </div>
            )
          ) : (
            <div className="flex items-center">
              <ButtonGroup>
                <ButtonGroupText className="text-[10px]">
                  Verify
                </ButtonGroupText>
                <Button
                  size="xs"
                  title="Mark as Correct"
                  className="bg-green-600 text-white hover:bg-green-700"
                  onClick={() => onCorrect(index)}
                >
                  <CheckIcon className="w-3 h-3" />
                </Button>

                <Button
                  size="xs"
                  title="Mark as Wrong"
                  onClick={() => onWrong(index)}
                >
                  <XIcon className="w-3 h-3" />
                </Button>
              </ButtonGroup>
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});

AttributeRow.displayName = "AttributeRow";

export function AttributesTable({ 
  attributes, 
  onAttributeUpdate,
  onTimestampClick,
  isCompact = false
}: AttributesTableProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"correct" | "incorrect" | null>(null);
  const [dialogStep, setDialogStep] = useState<"input" | "confirm">("input");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const resetDialog = () => {
    setDialogOpen(false);
  };

  const handleCorrectClick = React.useCallback((index: number) => {
    setDialogMode("correct");
    setSelectedIndex(index);
    setDialogStep("confirm");
    setDialogOpen(true);
  }, []);

  const handleWrongClick = React.useCallback((index: number) => {
    setDialogMode("incorrect");
    setSelectedIndex(index);
    setDialogStep("input");
    setDialogOpen(true);
  }, []);

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

    if (dialogMode === "incorrect") {
      onAttributeUpdate(selectedIndex, {
        ...attribute,
        feedback: data?.feedback,
        status: "incorrect",
      });

      toast.success("Feedback saved");
    }

    resetDialog();
  };

  return (
    <>
      <div className="hidden xl:block">
        <Table className="text-xs table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>
              {isCompact ? <TruncatedCell content="Property" /> : "Property"}
            </TableHead>
            <TableHead>
              {isCompact ? <TruncatedCell content="Attribute" /> : "Attribute"}
            </TableHead>
            <TableHead>
              {isCompact ? <TruncatedCell content="Value" /> : "Value"}
            </TableHead>
            <TableHead>
              {isCompact ? <TruncatedCell content="Source" /> : "Source"}
            </TableHead>
            <TableHead className="w-[40%]">
              {isCompact ? <TruncatedCell content="Evidence" maxW="max-w-none" /> : "Evidence"}
            </TableHead>
            <TableHead className="w-[20%] truncate" title="Feedback">Feedback</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody className="[&_td]:whitespace-normal">
          {attributes.map((attribute, index) => (
            <AttributeRow 
              key={`${index}-${attribute.status}-${attribute.feedback}`}
              attribute={attribute}
              index={index}
              isCompact={isCompact}
              onCorrect={handleCorrectClick}
              onWrong={handleWrongClick}
              onTimestampClick={onTimestampClick}
            />
          ))}
        </TableBody>
      </Table>
      </div>

      {/* Mobile Card Layout */}
      <div className="xl:hidden flex flex-col gap-4 pb-20">
        {attributes.map((attribute, index) => {
          const isLocked =
            attribute.status === "correct" || attribute.status === "incorrect";

          return (
            <div key={index} className="flex flex-col gap-2 rounded-xl bg-card p-4 shadow-sm text-card-foreground">
              <div>
                <p className="text-xs font-normal text-muted-foreground uppercase pb-1 tracking-wide">
                  {fastHumanize(attribute.pipeline)} &gt; {fastHumanize(attribute.attribute)}
                </p>
                <p className="font-normal text-base text-foreground leading-tight">
                  {fastHumanize(attribute.value)}
                  <span className="text-xs font-normal text-muted-foreground ml-2">
                    ({fastHumanize(attribute.source)})
                  </span>
                </p>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed break-words whitespace-normal py-1">
                {fastHumanize(attribute.evidence)}
              </p>

              <div className="flex items-center justify-between pt-2 border-t mt-1">
                <div className="flex items-center gap-2">
                  {attribute.timestamp_seconds !== null && attribute.timestamp_seconds !== undefined && (
                    <button
                      onClick={() => onTimestampClick?.(attribute.timestamp_seconds!, attribute.source || "interior")}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-2 py-1 rounded border border-blue-100"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      {attribute.timestamp_seconds.toFixed(2)}s
                    </button>
                  )}
                </div>

                <div className="flex items-center">
                  {isLocked ? (
                    attribute.status === "correct" ? (
                      <span className="text-green-600 font-normal text-sm flex items-center gap-1.5 pt-1">
                        <CheckIcon className="w-4 h-4" /> Marked Correct
                      </span>
                    ) : (
                      <div className="text-sm text-right">
                        <p className="text-red-500 font-normal flex items-center justify-end gap-1.5">
                          <XIcon className="w-4 h-4" /> Marked Incorrect
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground font-normal italic">
                          &quot;{attribute.feedback}&quot;
                        </p>
                      </div>
                    )
                  ) : (
                    <ButtonGroup>
                      <ButtonGroupText className="text-sm font-normal px-4">
                        Verify
                      </ButtonGroupText>
                      <Button
                        size="sm"
                        title="Mark as Correct"
                        className="bg-green-600 text-white hover:bg-green-700 h-9 px-4"
                        onClick={() => handleCorrectClick(index)}
                      >
                        <CheckIcon className="w-4.5 h-4.5" />
                      </Button>
                      <Button
                        size="sm"
                        title="Mark as Wrong"
                        className="h-9 px-4"
                        onClick={() => handleWrongClick(index)}
                      >
                        <XIcon className="w-4.5 h-4.5" />
                      </Button>
                    </ButtonGroup>
                  )}
                </div>
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