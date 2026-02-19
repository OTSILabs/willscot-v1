"use client";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { CopyIcon, DownloadIcon } from "lucide-react";
import JsonView from "@uiw/react-json-view";

interface RawJsonTabProps {
  resultId: string;
  payload: unknown;
}

export function RawJsonTab({ resultId, payload }: RawJsonTabProps) {
  const jsonString = JSON.stringify(payload, null, 2);

  function downloadJson() {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `trace-${resultId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="py-2 flex justify-end sticky top-0 bg-background z-10 border-b">
        <ButtonGroup orientation="horizontal">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => navigator.clipboard.writeText(jsonString)}
          >
            <CopyIcon />
            Copy
          </Button>
          <Button type="button" size="xs" onClick={downloadJson}>
            <DownloadIcon />
            Download
          </Button>
        </ButtonGroup>
      </div>

      <JsonView value={payload as object | undefined} className="p-4" />
    </div>
  );
}

