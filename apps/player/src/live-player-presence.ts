import {
  onDisconnect,
  ref,
  serverTimestamp,
  set,
  type Database,
} from "firebase/database";

export const PLAYER_PRESENCE_PATH = "live/playerPresence";

export type PlayerBootStage = "starting" | "ready" | "load-failed";
export type PlayerBootErrorCode =
  | "presentation-not-found"
  | "presentation-load-failed"
  | "player-mount-failed";

export interface PlayerPresenceReporter {
  ready(): void;
  failed(errorCode: PlayerBootErrorCode): void;
  stop(): void;
}

export type PlayerPresenceTransition =
  | "starting"
  | "ready"
  | "load-failed"
  | "cancel-disconnect";

export type PlayerPresenceErrorHandler = (
  transition: PlayerPresenceTransition,
  error: unknown,
) => void;

function createBootId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Owns the one current Player's liveness report. onDisconnect is registered
 * before the connected state is published so a dropped connection cannot leave
 * a freshly-created online record behind.
 */
export async function startPlayerPresence(
  database: Database,
  activationRevision: number,
  currentVersionId: string,
  onError: PlayerPresenceErrorHandler = () => undefined,
): Promise<PlayerPresenceReporter> {
  const presenceRef = ref(database, PLAYER_PRESENCE_PATH);
  const bootId = createBootId();
  const write = (connected: boolean, stage: PlayerBootStage, errorCode?: PlayerBootErrorCode) =>
    set(presenceRef, {
      activationRevision,
      currentVersionId,
      bootId,
      connected,
      stage,
      transitionedAt: serverTimestamp(),
      ...(errorCode === undefined ? {} : { errorCode }),
    });

  const disconnect = onDisconnect(presenceRef);
  await disconnect.set({
    activationRevision,
    currentVersionId,
    bootId,
    connected: false,
    stage: "starting",
    transitionedAt: serverTimestamp(),
  });
  await write(true, "starting");

  let stopped = false;

  const transition = (
    stage: PlayerBootStage,
    errorCode?: PlayerBootErrorCode,
  ): void => {
    if (stopped) return;

    void write(true, stage, errorCode).catch((error: unknown) => {
      onError(stage, error);
    });
  };

  return {
    ready: () => transition("ready"),
    failed: (errorCode) => transition("load-failed", errorCode),
    stop: () => {
      if (stopped) return;
      stopped = true;
      void disconnect.cancel().catch((error: unknown) => {
        onError("cancel-disconnect", error);
      });
    },
  };
}
