"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onValue, ref } from "firebase/database";

import {
  type Presentation,
  visitSlideElements,
} from "@powershow/document-schema";

import { writeGalleryControlState } from "./control-command-writer";
import { type LiveCurrent } from "./live-current";
import { getRealtimeDatabaseOrNull } from "./realtime-db";
import {
  buildGalleryControlRootPath,
  parseLiveGalleryControlState,
  type LiveGalleryControlState,
} from "../live/gallery-control";

export interface ControlGalleryView {
  slot: number;
  elementId: string;
  itemCount: number;
  targetIndex: number;
  expanded: boolean;
  pending: boolean;
}

export interface UseLiveGalleryControlOptions {
  live: LiveCurrent | null;
  livePresentation: Presentation | null;
  desiredPageId: string | null;
}

export interface UseLiveGalleryControlResult {
  galleries: ControlGalleryView[];
  sendFailed: boolean;
  nextGallery(elementId: string): void;
  setGalleryExpanded(elementId: string, expanded: boolean): void;
}

interface GalleryDescriptor {
  slot: number;
  elementId: string;
  itemCount: number;
}

interface LatestState {
  live: LiveCurrent | null;
  desiredPageId: string | null;
  galleries: ControlGalleryView[];
}

function galleryKey(slot: number, elementId: string): string {
  return `${slot}:${elementId}`;
}

function discoverGalleries(
  presentation: Presentation | null,
  desiredPageId: string | null,
): GalleryDescriptor[] {
  if (presentation === null || desiredPageId === null) return [];

  const slide = presentation.slides.find((candidate) => candidate.id === desiredPageId);
  if (slide === undefined) return [];

  const galleries: GalleryDescriptor[] = [];
  visitSlideElements(slide, (element) => {
    if (element.type === "gallery") {
      galleries.push({
        slot: galleries.length,
        elementId: element.id,
        itemCount: element.items.length,
      });
    }
  });
  return galleries;
}

function recordsForCurrentGalleries(
  value: unknown,
  live: LiveCurrent | null,
  desiredPageId: string | null,
  descriptors: readonly GalleryDescriptor[],
): Map<number, LiveGalleryControlState> {
  const records = new Map<number, LiveGalleryControlState>();
  if (value === null || typeof value !== "object" || live === null || desiredPageId === null) {
    return records;
  }

  const children = value as Record<string, unknown>;
  for (const descriptor of descriptors) {
    const record = parseLiveGalleryControlState(children[String(descriptor.slot)]);
    if (
      record !== null &&
      record.activationRevision === live.revision &&
      record.currentVersionId === live.currentVersionId &&
      record.pageId === desiredPageId &&
      record.elementId === descriptor.elementId &&
      record.targetIndex < descriptor.itemCount
    ) {
      records.set(descriptor.slot, record);
    }
  }
  return records;
}

/** Owns the Control-side desired Gallery intent for the active immutable version. */
export function useLiveGalleryControl({
  live,
  livePresentation,
  desiredPageId,
}: UseLiveGalleryControlOptions): UseLiveGalleryControlResult {
  const [rootSnapshot, setRootSnapshot] = useState<unknown>(null);
  const [committed, setCommitted] = useState<Map<number, LiveGalleryControlState>>(
    () => new Map(),
  );
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [sendFailed, setSendFailed] = useState(false);
  const identityRef = useRef(0);

  const descriptors = useMemo(
    () => discoverGalleries(livePresentation, desiredPageId),
    [livePresentation, desiredPageId],
  );
  const hydrated = useMemo(
    () => recordsForCurrentGalleries(rootSnapshot, live, desiredPageId, descriptors),
    [rootSnapshot, live, desiredPageId, descriptors],
  );
  const galleries = useMemo(() => descriptors.map((descriptor) => {
    const record = committed.get(descriptor.slot) ?? hydrated.get(descriptor.slot);
    return {
      ...descriptor,
      targetIndex: record?.targetIndex ?? 0,
      expanded: record?.expanded ?? false,
      pending: pending.has(galleryKey(descriptor.slot, descriptor.elementId)),
    };
  }), [committed, descriptors, hydrated, pending]);

  const latestRef = useRef<LatestState>({ live, desiredPageId, galleries });
  latestRef.current = { live, desiredPageId, galleries };

  useEffect(() => {
    identityRef.current += 1;
    setRootSnapshot(null);
    setCommitted(new Map());
    setPending(new Set());
    setSendFailed(false);

    if (live === null) return;
    const database = getRealtimeDatabaseOrNull();
    if (database === null) return;

    return onValue(ref(database, buildGalleryControlRootPath()), (snapshot) => {
      const value = snapshot.val();
      setRootSnapshot(value);
      setCommitted((previous) => {
        if (previous.size === 0) return previous;
        const next = new Map(previous);
        for (const [slot, record] of previous) {
          const candidate = parseLiveGalleryControlState(
            value !== null && typeof value === "object"
              ? (value as Record<string, unknown>)[String(slot)]
              : undefined,
          );
          if (candidate !== null && candidate.revision >= record.revision) {
            next.delete(slot);
          }
        }
        return next;
      });
    });
  }, [live?.revision, live?.currentVersionId]);

  const send = useCallback((elementId: string, update: (gallery: ControlGalleryView) => { targetIndex: number; expanded: boolean }) => {
    const current = latestRef.current;
    const gallery = current.galleries.find((candidate) => candidate.elementId === elementId);
    if (gallery === undefined || gallery.pending || current.live === null || current.desiredPageId === null) return;

    const next = update(gallery);
    const key = galleryKey(gallery.slot, gallery.elementId);
    const token = identityRef.current;
    const liveIdentity = current.live;
    const pageId = current.desiredPageId;
    const database = getRealtimeDatabaseOrNull();
    setSendFailed(false);
    if (database === null) {
      setSendFailed(true);
      return;
    }

    setPending((previous) => new Set(previous).add(key));
    void writeGalleryControlState(
      database,
      liveIdentity.revision,
      liveIdentity.currentVersionId,
      pageId,
      gallery.slot,
      gallery.elementId,
      next.targetIndex,
      next.expanded,
    ).then((record) => {
      if (identityRef.current !== token) return;
      setCommitted((previous) => new Map(previous).set(gallery.slot, record));
      setPending((previous) => {
        const result = new Set(previous);
        result.delete(key);
        return result;
      });
      setSendFailed(false);
    }).catch((error: unknown) => {
      console.error("Control: could not write Gallery intent", error);
      if (identityRef.current !== token) return;
      setPending((previous) => {
        const result = new Set(previous);
        result.delete(key);
        return result;
      });
      setSendFailed(true);
    });
  }, []);

  const nextGallery = useCallback((elementId: string) => {
    send(elementId, (gallery) => ({
      targetIndex: gallery.itemCount <= 1
        ? gallery.targetIndex
        : (gallery.targetIndex + 1) % gallery.itemCount,
      expanded: gallery.expanded,
    }));
  }, [send]);

  const setGalleryExpanded = useCallback((elementId: string, expanded: boolean) => {
    const gallery = latestRef.current.galleries.find((candidate) => candidate.elementId === elementId);
    if (gallery === undefined || gallery.pending || gallery.expanded === expanded) return;
    send(elementId, (current) => ({ targetIndex: current.targetIndex, expanded }));
  }, [send]);

  const guardedNextGallery = useCallback((elementId: string) => {
    const gallery = latestRef.current.galleries.find((candidate) => candidate.elementId === elementId);
    if (gallery === undefined || gallery.itemCount <= 1) return;
    nextGallery(elementId);
  }, [nextGallery]);

  return { galleries, sendFailed, nextGallery: guardedNextGallery, setGalleryExpanded };
}
