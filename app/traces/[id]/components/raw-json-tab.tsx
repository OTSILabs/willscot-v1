"use client";

import { Button } from "@/components/ui/button";

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
    <div className="rounded-md border">
      <div className="flex items-center justify-end gap-2 border-b p-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigator.clipboard.writeText(jsonString)}
        >
          Copy
        </Button>
        <Button type="button" size="sm" onClick={downloadJson}>
          Download
        </Button>
      </div>
      <pre className="max-h-[70vh] overflow-auto bg-zinc-950 p-4 text-[12px] leading-relaxed text-zinc-200">
        {jsonString}
      </pre>
    </div>
  );
}

