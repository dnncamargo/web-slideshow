"use client";

import { useMemo } from "react";

import { renderSlide } from "@powershow/renderer";
import type { Presentation, Slide } from "@powershow/document-schema";

import styles from "./presenter-view.module.css";

export interface PresenterSlidePreviewProps {
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
  slide,
  aspectRatio,
  variant,
}: PresenterSlidePreviewProps) {
  const markup = useMemo(() => renderSlide(slide), [slide]);

  const ratio = aspectRatio === "4:3" ? "4 / 3" : "16 / 9";
  const previewClass =
    variant === "current" ? styles.previewCurrent : styles.previewNext;

  return (
    <div
      className={`${styles.preview} ${previewClass}`}
      style={{ aspectRatio: ratio }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
