"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onValue, ref, set } from "firebase/database";

import type { LiveCurrent } from "./live-current";
import { getRealtimeDatabaseOrNull } from "./realtime-db";

export type LivePlayerControlsPosition =
  | "bottom-center"
  | "bottom-left"
  | "bottom-right"
  | "top-center"
  | "top-left"
  | "top-right";

export type LivePlayerControlsStyle = "floating" | "minimal" | "compact";

export type LivePlayerControlsAnimation = "fade" | "slide" | "none";

export interface LivePlayerControls {
  position: LivePlayerControlsPosition;
  style: LivePlayerControlsStyle;
  showCounter: boolean;
  animation: LivePlayerControlsAnimation;
}

export type LivePlayerControlsPatch = Partial<LivePlayerControls>;

export const PLAYER_CONTROLS_PATH = "live/playerControls";

/** Baseline do Live Player: posição inferior-direita, compacto, contador visível, fade. */
export const LIVE_PLAYER_CONTROLS_BASELINE: LivePlayerControls = {
  position: "bottom-right",
  style: "compact",
  showCounter: true,
  animation: "fade",
};

interface LivePlayerControlsRecord extends LivePlayerControls {
  activationRevision: number;
}

const LIVE_PLAYER_CONTROLS_POSITIONS: readonly LivePlayerControlsPosition[] = [
  "bottom-center",
  "bottom-left",
  "bottom-right",
  "top-center",
  "top-left",
  "top-right",
];

const LIVE_PLAYER_CONTROLS_STYLES: readonly LivePlayerControlsStyle[] = [
  "floating",
  "minimal",
  "compact",
];

const LIVE_PLAYER_CONTROLS_ANIMATIONS: readonly LivePlayerControlsAnimation[] = [
  "fade",
  "slide",
  "none",
];

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

export function parseLivePlayerControls(value: unknown): LivePlayerControlsRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 5 || !isNonNegativeInteger(record.activationRevision)) return null;
  if (!LIVE_PLAYER_CONTROLS_POSITIONS.includes(record.position as LivePlayerControlsPosition)) return null;
  if (!LIVE_PLAYER_CONTROLS_STYLES.includes(record.style as LivePlayerControlsStyle)) return null;
  if (typeof record.showCounter !== "boolean") return null;
  if (!LIVE_PLAYER_CONTROLS_ANIMATIONS.includes(record.animation as LivePlayerControlsAnimation)) return null;
  return {
    activationRevision: record.activationRevision,
    position: record.position as LivePlayerControlsPosition,
    style: record.style as LivePlayerControlsStyle,
    showCounter: record.showCounter,
    animation: record.animation as LivePlayerControlsAnimation,
  };
}

function resolve(value: unknown, live: LiveCurrent | null): LivePlayerControls {
  const record = parseLivePlayerControls(value);
  return record !== null && record.activationRevision === live?.revision
    ? {
        position: record.position,
        style: record.style,
        showCounter: record.showCounter,
        animation: record.animation,
      }
    : LIVE_PLAYER_CONTROLS_BASELINE;
}

export interface UseLivePlayerControlsControlResult {
  controls: LivePlayerControls;
  setControlsOptions(patch: LivePlayerControlsPatch): void;
  writeInFlight: boolean;
  sendFailed: boolean;
}

/** Owns the activation-scoped absolute desired Player controls for the Live session. */
export function useLivePlayerControlsControl(
  live: LiveCurrent | null,
): UseLivePlayerControlsControlResult {
  const [controls, setControls] = useState<LivePlayerControls>(LIVE_PLAYER_CONTROLS_BASELINE);
  const [writeInFlight, setWriteInFlight] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const latestRef = useRef(live);
  latestRef.current = live;
  const controlsRef = useRef<LivePlayerControls>(controls);
  controlsRef.current = controls;
  const writeInFlightRef = useRef(false);

  useEffect(() => {
    setControls(LIVE_PLAYER_CONTROLS_BASELINE);
    writeInFlightRef.current = false;
    setWriteInFlight(false);
    setSendFailed(false);
    if (live === null) return;
    const database = getRealtimeDatabaseOrNull();
    if (database === null) return;
    return onValue(ref(database, PLAYER_CONTROLS_PATH), (snapshot) => {
      setControls(resolve(snapshot.val(), live));
    });
  }, [live?.revision]);

  const setControlsOptions = useCallback((patch: LivePlayerControlsPatch) => {
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
    const next: LivePlayerControls = { ...controlsRef.current, ...patch };
    const activationRevision = current.revision;
    writeInFlightRef.current = true;
    setWriteInFlight(true);
    setSendFailed(false);
    // O registro no RTDB é estado completo, nunca um patch parcial.
    void set(ref(database, PLAYER_CONTROLS_PATH), {
      activationRevision,
      position: next.position,
      style: next.style,
      showCounter: next.showCounter,
      animation: next.animation,
    }).then(() => {
      writeInFlightRef.current = false;
      setWriteInFlight(false);
      if (latestRef.current?.revision === activationRevision) {
        setControls(next);
        setSendFailed(false);
      }
    }).catch((error: unknown) => {
      console.error("Control: could not write Player controls", error);
      writeInFlightRef.current = false;
      setWriteInFlight(false);
      // Falha só contamina a ativação atual.
      if (latestRef.current?.revision === activationRevision) setSendFailed(true);
    });
  }, []);

  return { controls, setControlsOptions, writeInFlight, sendFailed };
}