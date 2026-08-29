"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  fitLogicalSlideGeometry,
  renderSlide,
  resolveLogicalSlideSize,
} from "@powershow/renderer";
import type { Presentation, Slide } from "@powershow/document-schema";

import styles from "./presenter-view.module.css";

export interface PresenterSlidePreviewProps {
  presentation: Presentation;
  slide: Slide;
  aspectRatio: Presentation["aspectRatio"];
  variant: "current" | "next";
}

/**
 * Renders a single Slide with the existing @powershow/renderer.
 *
 * The outer box applies the presentation aspect ratio so the preview scales
 * correctly. It is reusable for both the current and next slide and owns only
 * preview/rendering responsibility: it does not hold Live state, presentation
 * loading, or navigation.
 */
export function PresenterSlidePreview({
  presentation,
  slide,
  aspectRatio,
  variant,
}: PresenterSlidePreviewProps) {
  const markup = useMemo(
    () => renderSlide(slide, { presentation }),
    [presentation, slide],
  );

  const logicalSize = resolveLogicalSlideSize(aspectRatio);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0);
  const previewClass =
    variant === "current" ? styles.previewCurrent : styles.previewNext;

  useEffect(() => {
    const preview = previewRef.current;

    if (!preview) {
      return;
    }

    const measure = () => {
      const rect = preview.getBoundingClientRect();
      setScale(
        fitLogicalSlideGeometry(aspectRatio, rect.width, rect.height).scale,
      );
    };

    measure();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(preview);

      return () => observer.disconnect();
    }

    window.addEventListener("resize", measure);

    return () => window.removeEventListener("resize", measure);
  }, [aspectRatio]);

  return (
    <div
      ref={previewRef}
      className={`${styles.preview} ${previewClass}`}
      style={{ aspectRatio: aspectRatio === "4:3" ? "4 / 3" : "16 / 9" }}
    >
      <div
        className={styles.previewSurface}
        style={{
          width: logicalSize.logicalWidth,
          height: logicalSize.logicalHeight,
          transform: `scale(${scale})`,
        }}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    </div>
  );
}
