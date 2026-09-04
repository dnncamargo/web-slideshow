"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onValue, ref, set } from "firebase/database";

import type { LiveCurrent } from "./live-current";
import { getRealtimeDatabaseOrNull } from "./realtime-db";

export type LiveSlideTransition = "fade" | "slide" | "none";
export const SLIDE_TRANSITION_PATH = "live/slideTransition";

interface LiveSlideTransitionRecord {
  activationRevision: number;
  transition: LiveSlideTransition;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

export function parseLiveSlideTransition(value: unknown): LiveSlideTransitionRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 2 || !isNonNegativeInteger(record.activationRevision)) return null;
  if (record.transition !== "fade" && record.transition !== "slide" && record.transition !== "none") return null;
  return { activationRevision: record.activationRevision, transition: record.transition };
}

function resolve(value: unknown, live: LiveCurrent | null): LiveSlideTransition {
  const record = parseLiveSlideTransition(value);
  return record !== null && record.activationRevision === live?.revision
    ? record.transition
    : "fade";
}

export interface UseLiveSlideTransitionControlResult {
  transition: LiveSlideTransition;
  setTransition(value: LiveSlideTransition): void;
  writeInFlight: boolean;
  sendFailed: boolean;
}

/** Owns the independent, activation-scoped live slide transition preference. */
export function useLiveSlideTransitionControl(
  live: LiveCurrent | null,
): UseLiveSlideTransitionControlResult {
  const [transition, setSelectedTransition] = useState<LiveSlideTransition>("fade");
  const [writeInFlight, setWriteInFlight] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const latestRef = useRef(live);
  latestRef.current = live;
  const writeInFlightRef = useRef(false);

  useEffect(() => {
    setSelectedTransition("fade");
    writeInFlightRef.current = false;
    setWriteInFlight(false);
    setSendFailed(false);
    if (live === null) return;
    const database = getRealtimeDatabaseOrNull();
    if (database === null) return;
    return onValue(ref(database, SLIDE_TRANSITION_PATH), (snapshot) => {
      setSelectedTransition(resolve(snapshot.val(), live));
    });
  }, [live?.revision]);

  const setTransition = useCallback((next: LiveSlideTransition) => {
    if (next !== "fade" && next !== "slide" && next !== "none") return;
    const current = latestRef.current;
    const database = getRealtimeDatabaseOrNull();
    if (current === null || database === null) {
      setSendFailed(true);
      return;
    }
    // Somente uma escrita em andamento; chamadas adicionais falham fechado.
    if (writeInFlightRef.current) {
      return;
    }
    const activationRevision = current.revision;
    writeInFlightRef.current = true;
    setWriteInFlight(true);
    setSendFailed(false);
    void set(ref(database, SLIDE_TRANSITION_PATH), {
      activationRevision,
      transition: next,
    }).then(() => {
      if (latestRef.current?.revision !== activationRevision) return;
      writeInFlightRef.current = false;
      setWriteInFlight(false);
      setSelectedTransition(next);
      setSendFailed(false);
    }).catch((error: unknown) => {
      if (latestRef.current?.revision !== activationRevision) return;
      console.error("Control: could not write slide transition", error);
      writeInFlightRef.current = false;
      setWriteInFlight(false);
      setSendFailed(true);
    });
  }, []);

  return { transition, setTransition, writeInFlight, sendFailed };
}
