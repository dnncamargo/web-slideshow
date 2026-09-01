"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  fitLogicalSlideGeometry,
  hydrateRendererRuntime,
  paletteColorCssVariableName,
  renderSlide,
  resolveLogicalSlideSize,
} from "@powershow/renderer";
import type { Presentation, Slide } from "@powershow/document-schema";

import styles from "./presenter-view.module.css";

export interface PresenterGalleryTarget {
  elementId: string;
  targetIndex: number;
}

export function projectGalleryTargets(
  root: ParentNode,
  targets: readonly PresenterGalleryTarget[],
): void {
  for (const target of targets) {
    if (!Number.isInteger(target.targetIndex) || target.targetIndex < 0) continue;
    const gallery = Array.from(root.querySelectorAll<HTMLElement>(
      '[data-powershow-type="gallery"][data-powershow-id]',
    )).find((candidate) => candidate.dataset.powershowId === target.elementId);
    if (!gallery) continue;

    const items = Array.from(gallery.querySelectorAll<HTMLElement>(
      ".powershow-gallery-item[data-powershow-gallery-index]",
    ));
    const active = items.find(
      (item) => Number(item.dataset.powershowGalleryIndex) === target.targetIndex,
    );
    if (!active) continue;

    for (const item of items) {
      const isActive = item === active;
      item.classList.toggle("powershow-gallery-item-active", isActive);
      item.style.visibility = isActive ? "" : "hidden";
      item.style.pointerEvents = isActive ? "" : "none";
      if (isActive) item.removeAttribute("aria-hidden");
      else item.setAttribute("aria-hidden", "true");
    }
  }
}

export interface PresenterSlidePreviewProps {
  presentation: Presentation;
  slide: Slide;
  aspectRatio: Presentation["aspectRatio"];
  variant: "current" | "next";
  galleryTargets?: readonly PresenterGalleryTarget[];
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
  galleryTargets = [],
}: PresenterSlidePreviewProps) {
  const markup = useMemo(
    () => renderSlide(slide, { presentation }),
    [presentation, slide],
  );

  const logicalSize = resolveLogicalSlideSize(aspectRatio);
  const paletteStyle = Object.fromEntries(
    (presentation.palette?.colors ?? []).map((color) => [
      paletteColorCssVariableName(color.id),
      color.value,
    ]),
  );
  const previewRef = useRef<HTMLDivElement | null>(null);
  const previewSurfaceRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    if (!previewSurfaceRef.current) return;
    hydrateRendererRuntime(previewSurfaceRef.current);
    projectGalleryTargets(previewSurfaceRef.current, galleryTargets);
  }, [galleryTargets, markup]);

  return (
    <div
      ref={previewRef}
      className={`${styles.preview} ${previewClass}`}
      style={{ aspectRatio: aspectRatio === "4:3" ? "4 / 3" : "16 / 9" }}
    >
      <div
        ref={previewSurfaceRef}
        className={styles.previewSurface}
        style={{
          width: logicalSize.logicalWidth,
          height: logicalSize.logicalHeight,
          transform: `scale(${scale})`,
          ...paletteStyle,
        } as CSSProperties}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    </div>
  );
}
