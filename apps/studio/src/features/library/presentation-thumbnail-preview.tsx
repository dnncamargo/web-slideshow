"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  hydrateRendererRuntime,
  renderSlide,
  resolveLogicalSlideSize,
} from "@powershow/renderer";

import type { PresentationThumbnailPreview } from "../persistence/presentation-persistence";

import {
  computeThumbnailScale,
  thumbnailLogicalHeight,
} from "./presentation-thumbnail-geometry";
import styles from "./presentation-library.module.css";

interface PresentationThumbnailPreviewProps {
  preview: PresentationThumbnailPreview;
}

/**
 * Renders the FIRST slide of a presentation into a logical preview canvas and
 * scales the whole canvas down to fit the Library thumbnail slot.
 *
 * The rendered subtree is visual only: aria-hidden, inert, and pointer-events
 * disabled so the Library row remains the single interactive selection target.
 */
export function PresentationThumbnailPreview({
  preview,
}: PresentationThumbnailPreviewProps) {
  const markup = useMemo(
    () => renderSlide(preview.firstSlide),
    [preview.firstSlide],
  );

  const logicalWidth = resolveLogicalSlideSize(preview.aspectRatio).logicalWidth;
  const logicalHeight = thumbnailLogicalHeight(preview.aspectRatio);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const measure = () => {
      const rect = host.getBoundingClientRect();

      setScale(
        computeThumbnailScale(
          rect.width,
          rect.height,
          logicalWidth,
          logicalHeight,
        ),
      );
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(host);

    return () => observer.disconnect();
  }, [logicalWidth, logicalHeight]);

  useEffect(() => {
    if (stageRef.current) hydrateRendererRuntime(stageRef.current);
  }, [markup]);

  return (
    <div
      ref={hostRef}
      className={styles.thumbnailPreview}
      aria-hidden="true"
      inert
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <div
        ref={stageRef}
        className={styles.thumbnailPreviewStage}
        style={{
          width: logicalWidth,
          height: logicalHeight,
          transform: `scale(${scale})`,
        }}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    </div>
  );
}
