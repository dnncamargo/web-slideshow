"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  fitLogicalSlideGeometry,
  hydrateRendererRuntime,
  paletteColorCssVariableName,
  renderSlide,
  resolveLogicalSlideSize,
  setCheckboxRuntimeState,
} from "@web-slideshow/renderer";
import type { CheckboxRuntimeState } from "@web-slideshow/renderer";
import { materializeSlide, type Presentation, type Slide } from "@web-slideshow/document-schema";

import styles from "./presenter-view.module.css";

export interface PresenterGalleryTarget {
  elementId: string;
  targetIndex: number;
}

export interface PresenterCheckboxTarget {
  slot: number;
  elementId: string;
  checkboxId: string;
  state: CheckboxRuntimeState;
}

function getGalleryItems(gallery: HTMLElement): HTMLElement[] {
  return Array.from(gallery.querySelectorAll<HTMLElement>(
    ".presentation-gallery-item[data-presentation-gallery-index]",
  )).filter(
    (item) => item.closest<HTMLElement>('[data-presentation-type="gallery"]') === gallery,
  );
}

function resetGalleryProjection(root: ParentNode): void {
  for (const gallery of root.querySelectorAll<HTMLElement>(
    '[data-presentation-type="gallery"][data-presentation-id]',
  )) {
    for (const item of getGalleryItems(gallery)) {
      const isDefault = Number(item.dataset.presentationGalleryIndex) === 0;
      item.classList.toggle("presentation-gallery-item-active", isDefault);
      item.style.visibility = isDefault ? "" : "hidden";
      item.style.pointerEvents = isDefault ? "" : "none";
      if (isDefault) item.removeAttribute("aria-hidden");
      else item.setAttribute("aria-hidden", "true");
    }
  }
}

export function projectGalleryTargets(
  root: ParentNode,
  targets: readonly PresenterGalleryTarget[],
): void {
  resetGalleryProjection(root);

  for (const target of targets) {
    if (!Number.isInteger(target.targetIndex) || target.targetIndex < 0) continue;
    const gallery = Array.from(root.querySelectorAll<HTMLElement>(
      '[data-presentation-type="gallery"][data-presentation-id]',
    )).find((candidate) => candidate.dataset.presentationId === target.elementId);
    if (!gallery) continue;

    const items = getGalleryItems(gallery);
    const active = items.find(
      (item) => Number(item.dataset.presentationGalleryIndex) === target.targetIndex,
    );
    if (!active) continue;

    for (const item of items) {
      const isActive = item === active;
      item.classList.toggle("presentation-gallery-item-active", isActive);
      item.style.visibility = isActive ? "" : "hidden";
      item.style.pointerEvents = isActive ? "" : "none";
      if (isActive) item.removeAttribute("aria-hidden");
      else item.setAttribute("aria-hidden", "true");
    }
  }
}

function presentationCheckboxes(root: ParentNode): HTMLInputElement[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>(
    'input[data-presentation-checkbox="true"]',
  ));
}

function checkboxForOwner(
  owner: HTMLElement,
  checkboxId: string,
): HTMLInputElement | null {
  for (const input of owner.querySelectorAll<HTMLInputElement>(
    'input[data-presentation-checkbox="true"]',
  )) {
    if (input.dataset.presentationCheckboxId !== checkboxId) continue;
    if (input.closest("[data-presentation-id]") !== owner) continue;
    return input;
  }
  return null;
}

/** Projects absolute Checkbox state without emitting renderer onChange events. */
export function projectCheckboxTargets(
  root: ParentNode,
  targets: readonly PresenterCheckboxTarget[],
): void {
  const owners = Array.from(root.querySelectorAll<HTMLElement>("[data-presentation-id]"));
  for (const target of targets) {
    const owner = owners.find(
      (candidate) => candidate.dataset.presentationId === target.elementId,
    );
    if (!owner) continue;
    const input = checkboxForOwner(owner, target.checkboxId);
    if (!input) continue;
    setCheckboxRuntimeState(input, target.state);
  }
}

export interface PresenterSlidePreviewProps {
  presentation: Presentation;
  slide: Slide;
  aspectRatio: Presentation["aspectRatio"];
  variant: "current" | "next";
  galleryTargets?: readonly PresenterGalleryTarget[];
  checkboxTargets?: readonly PresenterCheckboxTarget[];
  onCheckboxChange?(
    slot: number,
    elementId: string,
    checkboxId: string,
    state: CheckboxRuntimeState,
  ): void;
}

/**
 * Renders a single Slide with the existing @web-slideshow/renderer.
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
  checkboxTargets = [],
  onCheckboxChange,
}: PresenterSlidePreviewProps) {
  const effectiveSlide = useMemo(
    () => materializeSlide(presentation, slide).slide,
    [presentation, slide],
  );
  const markup = useMemo(() => renderSlide(effectiveSlide, { presentation }), [effectiveSlide, presentation]);
  const renderedMarkup = useMemo(
    () => ({ __html: markup }),
    [markup],
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

  const handleCheckboxChange = useCallback((input: HTMLInputElement, state: CheckboxRuntimeState) => {
    if (variant !== "current" || onCheckboxChange === undefined) return;
    if (!previewSurfaceRef.current || !previewSurfaceRef.current.contains(input)) return;
    const checkboxId = input.dataset.presentationCheckboxId;
    const owner = input.closest<HTMLElement>("[data-presentation-id]");
    const elementId = owner?.dataset.presentationId;
    if (checkboxId === undefined || elementId === undefined) return;
    const inputs = presentationCheckboxes(previewSurfaceRef.current);
    const slot = inputs.indexOf(input);
    if (slot < 0) return;
    onCheckboxChange(slot, elementId, checkboxId, state);
  }, [onCheckboxChange, variant]);

  useEffect(() => {
    if (!previewSurfaceRef.current) return;
    hydrateRendererRuntime(
      previewSurfaceRef.current,
      variant === "current"
        ? { checkboxes: { onChange: handleCheckboxChange } }
        : { checkboxes: { onChange: undefined } },
    );
  }, [handleCheckboxChange, markup, variant]);

  useEffect(() => {
    if (!previewSurfaceRef.current) return;
    projectGalleryTargets(previewSurfaceRef.current, galleryTargets);
  }, [galleryTargets, markup]);

  useEffect(() => {
    if (!previewSurfaceRef.current) return;
    projectCheckboxTargets(previewSurfaceRef.current, checkboxTargets);
  }, [checkboxTargets, markup]);

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
        dangerouslySetInnerHTML={renderedMarkup}
      />
    </div>
  );
}
