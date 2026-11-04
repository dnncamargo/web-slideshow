import {
  get,
  onDisconnect,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  type Database,
} from "firebase/database";
import { buildLivePath } from "./live-path";

export const PLAYER_PRESENCE_PATH = "playerPresence";
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
  stopAndWait(): Promise<void>;
}

export type PlayerPresenceTransition =
  | "starting"
  | "ready"
  | "load-failed";

export type PlayerPresenceErrorHandler = (
  transition: PlayerPresenceTransition,
  error: unknown,
) => void;

function recordPlayerUid(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const playerUid = (value as { playerUid?: unknown }).playerUid;
  return typeof playerUid === "string" ? playerUid : null;
}

/** Removes only this Player's presence and cancels its pending disconnect writes. */
export async function clearPlayerPresence(
  database: Database,
  ownerUid: string,
  playerUid: string,
): Promise<void> {
  const presenceRef = ref(database, buildLivePath(ownerUid, PLAYER_PRESENCE_PATH));
  const snapshot = await get(presenceRef);
  const value = snapshot.val();
  if (typeof value !== "object" || value === null) return;

  const root = value as Record<string, unknown>;
  const leases = typeof root.leases === "object" && root.leases !== null
    ? root.leases as Record<string, unknown>
    : {};
  const ownedBootIds = Object.entries(leases)
    .filter(([bootId, lease]) => bootId !== "" && !bootId.includes("/") && recordPlayerUid(lease) === playerUid)
    .map(([bootId]) => bootId);

  await Promise.all(ownedBootIds.map((bootId) =>
    onDisconnect(ref(database, buildLivePath(ownerUid, `${PLAYER_PRESENCE_PATH}/leases/${bootId}`))).cancel(),
  ));

  await Promise.all([
    ...ownedBootIds.map((bootId) => runTransaction(
      ref(database, buildLivePath(ownerUid, `${PLAYER_PRESENCE_PATH}/leases/${bootId}`)),
      (current) => recordPlayerUid(current) === playerUid ? null : undefined,
      { applyLocally: false },
    )),
    ...(recordPlayerUid(root.current) === playerUid ? [runTransaction(
      ref(database, buildLivePath(ownerUid, `${PLAYER_PRESENCE_PATH}/current`)),
      (current) => recordPlayerUid(current) === playerUid ? null : undefined,
      { applyLocally: false },
    )] : []),
  ]);
}

function createBootId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Publishes the current Player report only after its boot-scoped connection
 * lease is online and protected by an onDisconnect write.
 */
export async function startPlayerPresence(
  database: Database,
  ownerUid: string,
  playerUid: string,
  activationRevision: number,
  currentVersionId: string,
  onError: PlayerPresenceErrorHandler = () => undefined,
): Promise<PlayerPresenceReporter> {
  const bootId = createBootId();
  const currentRef = ref(database, buildLivePath(ownerUid, `${PLAYER_PRESENCE_PATH}/current`));
  const leaseRef = ref(database, buildLivePath(ownerUid, `${PLAYER_PRESENCE_PATH}/leases/${bootId}`));
  const writeCurrent = (
    stage: PlayerBootStage,
    errorCode?: PlayerBootErrorCode,
  ) =>
    set(currentRef, {
      activationRevision,
      currentVersionId,
      playerUid,
      bootId,
      stage,
      transitionedAt: serverTimestamp(),
      ...(errorCode === undefined ? {} : { errorCode }),
    });

  const disconnect = onDisconnect(leaseRef);
  await disconnect.set({
    activationRevision,
    currentVersionId,
    playerUid,
    bootId,
    connected: false,
    transitionedAt: serverTimestamp(),
  });
  await set(leaseRef, {
    activationRevision,
    currentVersionId,
    playerUid,
    bootId,
    connected: true,
    transitionedAt: serverTimestamp(),
  });
  await writeCurrent("starting");

  let stopped = false;
  let stopPromise: Promise<void> | undefined;
  const pendingTransitions = new Set<Promise<void>>();

  const transition = (
    stage: PlayerBootStage,
    errorCode?: PlayerBootErrorCode,
  ): void => {
    if (stopped) return;

    const write = writeCurrent(stage, errorCode).catch((error: unknown) => {
      onError(stage, error);
    });
    pendingTransitions.add(write);
    void write.finally(() => pendingTransitions.delete(write));
  };

  const stopAndWait = (): Promise<void> => {
    if (stopPromise !== undefined) return stopPromise;
    stopped = true;
    stopPromise = (async () => {
      await disconnect.cancel();
      await Promise.all([...pendingTransitions]);
      await Promise.all([
        remove(leaseRef),
        runTransaction(
          currentRef,
          (current) => {
            if (typeof current !== "object" || current === null) return;
            const record = current as { bootId?: unknown; playerUid?: unknown };
            return record.bootId === bootId && record.playerUid === playerUid
              ? null
              : undefined;
          },
          { applyLocally: false },
        ),
      ]);
    })();
    return stopPromise;
  };

  return {
    bootId,
    starting: () => transition("starting"),
    ready: () => transition("ready"),
    failed: (errorCode) => transition("load-failed", errorCode),
    stop: () => { void stopAndWait().catch(() => undefined); },
    stopAndWait,
  };
}
