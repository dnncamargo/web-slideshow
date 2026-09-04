"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onValue, ref, set } from "firebase/database";

import type { LiveCurrent } from "./live-current";
import { getRealtimeDatabaseOrNull } from "./realtime-db";

export const PLAYER_LOGS_PATH = "live/playerLogs";

interface LivePlayerLogsRecord { activationRevision: number; enabled: boolean; }

function isActivationRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

export function parseLivePlayerLogs(value: unknown): LivePlayerLogsRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 2 || !isActivationRevision(record.activationRevision) || typeof record.enabled !== "boolean") return null;
  return { activationRevision: record.activationRevision, enabled: record.enabled };
}

function resolve(value: unknown, live: LiveCurrent | null): boolean {
  const record = parseLivePlayerLogs(value);
  return record !== null && record.activationRevision === live?.revision ? record.enabled : false;
}

export interface UseLivePlayerLogsControlResult {
  enabled: boolean;
  setEnabled(enabled: boolean): void;
  writeInFlight: boolean;
  sendFailed: boolean;
}

/** Owns the activation-scoped desired diagnostics URL state for connected Players. */
export function useLivePlayerLogsControl(live: LiveCurrent | null): UseLivePlayerLogsControlResult {
  const [enabled, setCurrentEnabled] = useState(false);
  const [writeInFlight, setWriteInFlight] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const latestRef = useRef(live);
  latestRef.current = live;
  const writeInFlightRef = useRef(false);

  useEffect(() => {
    setCurrentEnabled(false);
    writeInFlightRef.current = false;
    setWriteInFlight(false);
    setSendFailed(false);
    if (live === null) return;
    const database = getRealtimeDatabaseOrNull();
    if (database === null) return;
    return onValue(ref(database, PLAYER_LOGS_PATH), (snapshot) => {
      setCurrentEnabled(resolve(snapshot.val(), live));
    });
  }, [live?.revision]);

  const setEnabled = useCallback((next: boolean) => {
    const current = latestRef.current;
    const database = getRealtimeDatabaseOrNull();
    if (current === null || database === null) { setSendFailed(true); return; }
    if (writeInFlightRef.current) return;
    const activationRevision = current.revision;
    writeInFlightRef.current = true;
    setWriteInFlight(true);
    setSendFailed(false);
    void set(ref(database, PLAYER_LOGS_PATH), { activationRevision, enabled: next }).then(() => {
      if (latestRef.current?.revision !== activationRevision) return;
      writeInFlightRef.current = false;
      setWriteInFlight(false);
      setCurrentEnabled(next);
      setSendFailed(false);
    }).catch((error: unknown) => {
      if (latestRef.current?.revision !== activationRevision) return;
      console.error("Control: could not write Player logs state", error);
      writeInFlightRef.current = false;
      setWriteInFlight(false);
      setSendFailed(true);
    });
  }, []);

  return { enabled, setEnabled, writeInFlight, sendFailed };
}
