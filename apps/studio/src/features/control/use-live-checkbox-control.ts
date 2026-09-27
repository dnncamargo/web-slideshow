"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onValue, ref } from "firebase/database";

import { writeCheckboxControlState } from "./control-command-writer";
import type { LiveCurrent } from "./live-current";
import { getRealtimeDatabaseOrNull } from "./realtime-db";
import {
  buildCheckboxControlRootPath,
  parseLiveCheckboxControlState,
  type LiveCheckboxControlState,
} from "../live/checkbox-control";
import type { CheckboxRuntimeState } from "@web-slideshow/renderer";

export interface ControlCheckboxTarget {
  slot: number;
  elementId: string;
  checkboxId: string;
  state: CheckboxRuntimeState;
}

export interface UseLiveCheckboxControlOptions {
  live: LiveCurrent | null;
  desiredPageId: string | null;
}

export interface UseLiveCheckboxControlResult {
  targets: readonly ControlCheckboxTarget[];
  sendFailed: boolean;
  setCheckboxState(
    slot: number,
    elementId: string,
    checkboxId: string,
    state: CheckboxRuntimeState,
  ): void;
}

interface CheckboxCommandContext {
  activationRevision: number;
  currentVersionId: string;
  pageId: string;
  slot: number;
  elementId: string;
  checkboxId: string;
}

function currentRecord(
  value: unknown,
  live: LiveCurrent | null,
  desiredPageId: string | null,
): Map<number, LiveCheckboxControlState> {
  const records = new Map<number, LiveCheckboxControlState>();
  if (typeof value !== "object" || value === null || live === null || desiredPageId === null) {
    return records;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (!/^(0|[1-9]\d*)$/.test(key)) continue;
    const slot = Number(key);
    const record = parseLiveCheckboxControlState(child);
    if (
      !Number.isSafeInteger(slot) ||
      slot < 0 ||
      record === null ||
      record.activationRevision !== live.revision ||
      record.currentVersionId !== live.currentVersionId ||
      record.pageId !== desiredPageId
    ) continue;
    records.set(slot, record);
  }
  return records;
}

function commandMatchesCurrent(
  command: CheckboxCommandContext,
  live: LiveCurrent | null,
  desiredPageId: string | null,
): boolean {
  return live !== null &&
    desiredPageId !== null &&
    command.activationRevision === live.revision &&
    command.currentVersionId === live.currentVersionId &&
    command.pageId === desiredPageId;
}

/** Owns the Control-side absolute Checkbox intent for the active Live page. */
export function useLiveCheckboxControl({
  live,
  desiredPageId,
}: UseLiveCheckboxControlOptions): UseLiveCheckboxControlResult {
  const [rootSnapshot, setRootSnapshot] = useState<unknown>(null);
  const [localWrites, setLocalWrites] = useState<Map<number, LiveCheckboxControlState>>(
    () => new Map(),
  );
  const [sendFailed, setSendFailed] = useState(false);
  const latestRef = useRef({ live, desiredPageId });
  const writeTokensRef = useRef<Map<number, number>>(new Map());
  latestRef.current = { live, desiredPageId };

  const records = useMemo(
    () => currentRecord(rootSnapshot, live, desiredPageId),
    [rootSnapshot, live, desiredPageId],
  );
  const targets = useMemo(() => {
    const merged = new Map(records);
    for (const [slot, record] of localWrites) {
      if (record.activationRevision === live?.revision &&
          record.currentVersionId === live.currentVersionId &&
          record.pageId === desiredPageId) {
        merged.set(slot, record);
      }
    }
    return [...merged.entries()]
      .sort(([left], [right]) => left - right)
      .map(([slot, record]) => ({
        slot,
        elementId: record.elementId,
        checkboxId: record.checkboxId,
        state: record.state,
      }));
  }, [desiredPageId, live?.currentVersionId, live?.revision, localWrites, records]);

  useEffect(() => {
    setRootSnapshot(null);
    setLocalWrites(new Map());
    setSendFailed(false);
    writeTokensRef.current.clear();

    if (live === null) return;
    const database = getRealtimeDatabaseOrNull();
    if (database === null) return;

    return onValue(ref(database, buildCheckboxControlRootPath()), (snapshot) => {
      const value = snapshot.val();
      setRootSnapshot(value);
      setLocalWrites((previous) => {
        if (previous.size === 0) return previous;
        const next = new Map(previous);
        for (const [slot, local] of previous) {
          const candidate = parseLiveCheckboxControlState(
            value !== null && typeof value === "object"
              ? (value as Record<string, unknown>)[String(slot)]
              : undefined,
          );
          if (candidate !== null && candidate.revision >= local.revision) {
            next.delete(slot);
          }
        }
        return next;
      });
    });
  }, [live?.currentVersionId, live?.revision]);

  useEffect(() => {
    setLocalWrites(new Map());
    setSendFailed(false);
    writeTokensRef.current.clear();
  }, [desiredPageId]);

  const setCheckboxState = useCallback(
    (slot: number, elementId: string, checkboxId: string, state: CheckboxRuntimeState) => {
      const current = latestRef.current;
      if (
        !Number.isSafeInteger(slot) ||
        slot < 0 ||
        !commandMatchesCurrent(
          {
            activationRevision: current.live?.revision ?? -1,
            currentVersionId: current.live?.currentVersionId ?? "",
            pageId: current.desiredPageId ?? "",
            slot,
            elementId,
            checkboxId,
          },
          current.live,
          current.desiredPageId,
        )
      ) return;

      const liveIdentity = current.live;
      const pageId = current.desiredPageId;
      if (liveIdentity === null || pageId === null) return;
      const token = (writeTokensRef.current.get(slot) ?? 0) + 1;
      writeTokensRef.current.set(slot, token);
      const command: CheckboxCommandContext = {
        activationRevision: liveIdentity.revision,
        currentVersionId: liveIdentity.currentVersionId,
        pageId,
        slot,
        elementId,
        checkboxId,
      };
      const optimistic: LiveCheckboxControlState = {
        ...command,
        // Keep an optimistic local state ahead of any stale RTDB snapshot while
        // the absolute write is in flight. The per-slot token below still
        // prevents an older completion from replacing a newer rapid activation.
        revision: Number.MAX_SAFE_INTEGER,
        state,
      };
      setLocalWrites((previous) => new Map(previous).set(slot, optimistic));
      setSendFailed(false);

      const database = getRealtimeDatabaseOrNull();
      if (database === null) {
        setSendFailed(true);
        return;
      }

      void writeCheckboxControlState(
        database,
        liveIdentity.revision,
        liveIdentity.currentVersionId,
        pageId,
        slot,
        elementId,
        checkboxId,
        state,
      ).then((record) => {
        if (!commandMatchesCurrent(command, latestRef.current.live, latestRef.current.desiredPageId)) return;
        if (writeTokensRef.current.get(slot) !== token) return;
        setLocalWrites((previous) => new Map(previous).set(slot, record));
        setSendFailed(false);
      }).catch((error: unknown) => {
        console.error("Control: could not write Checkbox intent", error);
        if (!commandMatchesCurrent(command, latestRef.current.live, latestRef.current.desiredPageId)) return;
        if (writeTokensRef.current.get(slot) !== token) return;
        setSendFailed(true);
      });
    },
    [],
  );

  return { targets, sendFailed, setCheckboxState };
}
