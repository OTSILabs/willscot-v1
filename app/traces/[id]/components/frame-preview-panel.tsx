"use client";

import { useState, type MouseEvent, type SyntheticEvent } from "react";

interface SelectedFrame {
  url: string;
  second: number;
}

interface FramePreviewPanelProps {
  selectedFrame: SelectedFrame | null;
}

const LENS_SIZE = 140;
const ZOOM_LEVEL = 2.5;

export function FramePreviewPanel({ selectedFrame }: FramePreviewPanelProps) {
  const [lens, setLens] = useState({
    visible: false,
    x: 0,
    y: 0,
    imageX: 0,
    imageY: 0,
    renderedWidth: 0,
    renderedHeight: 0,
  });
  const [imageNaturalSize, setImageNaturalSize] = useState({
    width: 0,
    height: 0,
  });

  function handleImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    setImageNaturalSize({
      width: event.currentTarget.naturalWidth,
      height: event.currentTarget.naturalHeight,
    });
  }

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (!imageNaturalSize.width || !imageNaturalSize.height) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const containerAspect = rect.width / rect.height;
    const imageAspect = imageNaturalSize.width / imageNaturalSize.height;

    let renderedWidth = rect.width;
    let renderedHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (imageAspect > containerAspect) {
      renderedHeight = rect.width / imageAspect;
      offsetY = (rect.height - renderedHeight) / 2;
    } else {
      renderedWidth = rect.height * imageAspect;
      offsetX = (rect.width - renderedWidth) / 2;
    }

    const inImageBounds =
      x >= offsetX &&
      x <= offsetX + renderedWidth &&
      y >= offsetY &&
      y <= offsetY + renderedHeight;

    if (!inImageBounds) {
      setLens((prev) => ({ ...prev, visible: false }));
      return;
    }

    const imageX = x - offsetX;
    const imageY = y - offsetY;

    setLens({
      visible: true,
      x,
      y,
      imageX,
      imageY,
      renderedWidth,
      renderedHeight,
    });
  }

  return (
    <div className="min-h-0 flex-1">
      {selectedFrame?.url ? (
        <div className="flex h-[calc(100%-22px)] flex-col gap-2">
          <div className="text-xs text-muted-foreground px-2">
            Timestamp: {selectedFrame.second}s
          </div>
          <div
            className="relative min-h-0 flex-1 aspect-video bg-muted cursor-crosshair overflow-hidden"
            onMouseLeave={() => setLens((prev) => ({ ...prev, visible: false }))}
            onMouseMove={handleMouseMove}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedFrame.url}
              alt={`Frame at ${selectedFrame.second}s`}
              className="h-full w-full object-contain"
              onLoad={handleImageLoad}
            />
            {lens.visible ? (
              <div
                className="pointer-events-none absolute rounded-full border border-border shadow-md"
                style={{
                  width: LENS_SIZE,
                  height: LENS_SIZE,
                  left: lens.x - LENS_SIZE / 2,
                  top: lens.y - LENS_SIZE / 2,
                  backgroundImage: `url(${selectedFrame.url})`,
                  backgroundRepeat: "no-repeat",
                  backgroundSize: `${lens.renderedWidth * ZOOM_LEVEL}px ${lens.renderedHeight * ZOOM_LEVEL}px`,
                  backgroundPosition: `${-(lens.imageX * ZOOM_LEVEL - LENS_SIZE / 2)}px ${-(lens.imageY * ZOOM_LEVEL - LENS_SIZE / 2)}px`,
                }}
              />
            ) : null}
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground px-2">
          Click a frame time in the table to preview the image and seek video.
        </div>
      )}
    </div>
  );
}

