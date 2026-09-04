import { onValue, ref, type Database } from "firebase/database";

import type {
  PlayerControlsAnimation,
  PlayerControlsOptions,
  PlayerControlsPosition,
  PlayerControlsStyle,
  PlayerController,
} from "./player";

export const PLAYER_CONTROLS_PATH = "live/playerControls";

export interface LivePlayerControlsRecord {
  activationRevision: number;
  position: PlayerControlsPosition;
  style: PlayerControlsStyle;
  showCounter: boolean;
  animation: PlayerControlsAnimation;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

const PLAYER_CONTROLS_POSITIONS: readonly PlayerControlsPosition[] = [
  "bottom-center",
  "bottom-left",
  "bottom-right",
  "top-center",
  "top-left",
  "top-right",
];

const PLAYER_CONTROLS_STYLES: readonly PlayerControlsStyle[] = [
  "floating",
  "minimal",
  "compact",
];

const PLAYER_CONTROLS_ANIMATIONS: readonly PlayerControlsAnimation[] = [
  "fade",
  "slide",
  "none",
];

export function parseLivePlayerControls(value: unknown): LivePlayerControlsRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 5 || !isNonNegativeInteger(record.activationRevision)) return null;
  if (!PLAYER_CONTROLS_POSITIONS.includes(record.position as PlayerControlsPosition)) return null;
  if (!PLAYER_CONTROLS_STYLES.includes(record.style as PlayerControlsStyle)) return null;
  if (typeof record.showCounter !== "boolean") return null;
  if (!PLAYER_CONTROLS_ANIMATIONS.includes(record.animation as PlayerControlsAnimation)) return null;
  return {
    activationRevision: record.activationRevision,
    position: record.position as PlayerControlsPosition,
    style: record.style as PlayerControlsStyle,
    showCounter: record.showCounter,
    animation: record.animation as PlayerControlsAnimation,
  };
}

export function resolveLivePlayerControls(
  value: unknown,
  activationRevision: number,
  fallbackControls: PlayerControlsOptions,
): PlayerControlsOptions {
  const record = parseLivePlayerControls(value);
  return record?.activationRevision === activationRevision
    ? {
        position: record.position,
        style: record.style,
        showCounter: record.showCounter,
        animation: record.animation,
      }
    : fallbackControls;
}

export function subscribeLivePlayerControls(
  database: Database,
  activationRevision: number,
  controller: Pick<PlayerController, "setControlsOptions">,
  fallbackControls: PlayerControlsOptions,
): () => void {
  return onValue(ref(database, PLAYER_CONTROLS_PATH), (snapshot) => {
    controller.setControlsOptions(
      resolveLivePlayerControls(snapshot.val(), activationRevision, fallbackControls),
    );
  });
}