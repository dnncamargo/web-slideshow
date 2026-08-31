import { onChildAdded, onChildChanged, ref, type Database } from "firebase/database";

import {
  visitSlideElements,
  type GalleryElement,
  type Presentation,
  type Slide,
} from "@powershow/document-schema";

import type { PlayerController } from "./player";

export const GALLERY_CONTROL_ROOT_PATH = "live/galleryControl";

export interface LiveGalleryControlState {
  activationRevision: number;
  currentVersionId: string;
  revision: number;
  pageId: string;
  elementId: string;
  targetIndex: number;
  expanded: boolean;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isCanonicalElementId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Strict parser for the one-way Gallery command record. */
export function parseLiveGalleryControlState(
  value: unknown,
): LiveGalleryControlState | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 7) return null;
  if (!isNonNegativeInteger(record.activationRevision)) return null;
  if (!isNonEmptyString(record.currentVersionId)) return null;
  if (!isNonNegativeInteger(record.revision) || record.revision < 1) return null;
  if (!isNonEmptyString(record.pageId)) return null;
  if (!isCanonicalElementId(record.elementId)) return null;
  if (!isNonNegativeInteger(record.targetIndex)) return null;
  if (typeof record.expanded !== "boolean") return null;

  return {
    activationRevision: record.activationRevision,
    currentVersionId: record.currentVersionId.trim(),
    revision: record.revision,
    pageId: record.pageId.trim(),
    elementId: record.elementId,
    targetIndex: record.targetIndex,
    expanded: record.expanded,
  };
}

function parseSlot(key: string | null): number | null {
  if (key === null || !/^(0|[1-9]\d*)$/.test(key)) return null;
  const slot = Number(key);
  return isNonNegativeInteger(slot) ? slot : null;
}

function galleriesOnSlide(slide: Slide): GalleryElement[] {
  const galleries: GalleryElement[] = [];
  visitSlideElements(slide, (element) => {
    if (element.type === "gallery") galleries.push(element);
  });
  return galleries;
}

/**
 * Applies only child-scoped Gallery changes. It never writes or acknowledges
 * Player-local interaction state.
 */
export function subscribeLiveGalleryControl(
  database: Database,
  activationRevision: number,
  currentVersionId: string,
  presentation: Presentation,
  controller: PlayerController,
): () => void {
  function apply(snapshot: { key: string | null; val(): unknown }): void {
    const slot = parseSlot(snapshot.key);
    const state = parseLiveGalleryControlState(snapshot.val());
    if (
      slot === null ||
      state === null ||
      state.activationRevision !== activationRevision ||
      state.currentVersionId !== currentVersionId
    ) {
      return;
    }

    const currentSlide = presentation.slides[controller.getCurrentIndex()];
    if (!currentSlide || currentSlide.id !== state.pageId) return;

    const gallery = galleriesOnSlide(currentSlide)[slot];
    if (
      !gallery ||
      gallery.id !== state.elementId ||
      state.targetIndex >= gallery.items.length
    ) {
      return;
    }

    controller.setGalleryActiveIndex(state.elementId, state.targetIndex);
    controller.setGalleryExpanded(state.elementId, state.expanded);
  }

  const root = ref(database, GALLERY_CONTROL_ROOT_PATH);
  const unsubscribeAdded = onChildAdded(root, apply);
  const unsubscribeChanged = onChildChanged(root, apply);

  return () => {
    unsubscribeAdded();
    unsubscribeChanged();
  };
}
