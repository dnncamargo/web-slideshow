import {
  onDisconnect,
  ref,
  serverTimestamp,
  set,
  type Database,
} from "firebase/database";

export const PLAYER_PRESENCE_PATH = "live/playerPresence";
export const PLAYER_PRESENCE_CURRENT_PATH = `${PLAYER_PRESENCE_PATH}/current`;

export type PlayerBootStage = "starting" | "ready" | "load-failed";
export type PlayerBootErrorCode =
  | "presentation-not-found"
  | "presentation-load-failed"
  | "player-mount-failed";

export interface PlayerPresenceReporter {
  readonly bootId: string;
  starting(): void;
  ready(): void;
  failed(errorCode: PlayerBootErrorCode): void;
  stop(): void;
}

export type PlayerPresenceTransition =
  | "starting"
  | "ready"
  | "load-failed";

export type PlayerPresenceErrorHandler = (
  transition: PlayerPresenceTransition,
  error: unknown,
) => void;

function createBootId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Publishes the current Player report only after its boot-scoped connection
 * lease is online and protected by an onDisconnect write.
 */
export async function startPlayerPresence(
  database: Database,
  activationRevision: number,
  currentVersionId: string,
  onError: PlayerPresenceErrorHandler = () => undefined,
): Promise<PlayerPresenceReporter> {
  const bootId = createBootId();
  const currentRef = ref(database, PLAYER_PRESENCE_CURRENT_PATH);
  const leaseRef = ref(database, `${PLAYER_PRESENCE_PATH}/leases/${bootId}`);
  const writeCurrent = (
    stage: PlayerBootStage,
    errorCode?: PlayerBootErrorCode,
  ) =>
    set(currentRef, {
      activationRevision,
      currentVersionId,
      bootId,
      stage,
      transitionedAt: serverTimestamp(),
      ...(errorCode === undefined ? {} : { errorCode }),
    });

  const disconnect = onDisconnect(leaseRef);
  await disconnect.set({
    activationRevision,
    currentVersionId,
    bootId,
    connected: false,
    transitionedAt: serverTimestamp(),
  });
  await set(leaseRef, {
    activationRevision,
    currentVersionId,
    bootId,
    connected: true,
    transitionedAt: serverTimestamp(),
  });
  await writeCurrent("starting");

  let stopped = false;

  const transition = (
    stage: PlayerBootStage,
    errorCode?: PlayerBootErrorCode,
  ): void => {
    if (stopped) return;

    void writeCurrent(stage, errorCode).catch((error: unknown) => {
      onError(stage, error);
    });
  };

  return {
    bootId,
    starting: () => transition("starting"),
    ready: () => transition("ready"),
    failed: (errorCode) => transition("load-failed", errorCode),
    stop: () => {
      if (stopped) return;
      stopped = true;
    },
  };
}
