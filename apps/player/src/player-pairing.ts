import {
  browserLocalPersistence,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  signInAnonymously,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import {
  get,
  equalTo,
  onValue,
  orderByChild,
  query,
  ref,
  remove,
  runTransaction,
  type Database,
  type TransactionResult,
  type Unsubscribe,
} from "firebase/database";

import { getPlayerFirebaseApp } from "./realtime-db";
import { recordPlayerDiagnostic } from "./player-diagnostics";
import { clearPlayerPresence } from "./live-player-presence";
import { playerBindingRemovalUpdater } from "./player-binding-reset";

export const PLAYER_BINDINGS_PATH = "playerBindings";
export const PLAYER_PAIRING_CODES_PATH = "playerPairingCodes";
export const PLAYER_PAIRING_CLAIMS_PATH = "playerPairingClaims";
export const PLAYER_PAIRING_PIN_TTL_MS = 60_000;
export const PLAYER_PAIRING_PIN_RENEWAL_MS = 30_000;
export const PLAYER_PAIRING_PIN_CLOCK_SAFETY_MARGIN_MS = 5_000;

const SERVER_TIME_OFFSET_PATH = ".info/serverTimeOffset";
const SERVER_TIME_OFFSET_TIMEOUT_MS = 5_000;
const IDENTITY_RESET_CHANNEL = "web-slideshow-player-identity";

function identityResetLockName(playerUid: string): string {
  return `web-slideshow-player-reset:${playerUid}`;
}

function identityResetMarkerKey(playerUid: string): string {
  return `web-slideshow:player-identity-reset:${playerUid}`;
}

function identityResetIsComplete(playerUid: string): boolean {
  try {
    return typeof localStorage !== "undefined" &&
      localStorage.getItem(identityResetMarkerKey(playerUid))?.startsWith("complete:") === true;
  } catch {
    return false;
  }
}

function identityResetIsMarked(playerUid: string): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(identityResetMarkerKey(playerUid)) !== null;
  } catch {
    return false;
  }
}

export type PlayerPairingState =
  | { kind: "pairing"; pin: string }
  | { kind: "paired"; ownerUid: string }
  | { kind: "error"; message: string };

export interface PlayerPairingSession {
  playerUid: string;
  state: PlayerPairingState;
  destroy(): void;
}

interface PairingRecord {
  playerUid: string;
  expiresAt: number;
}

type PairingDiagnosticCode =
  | "PLAYER_PAIRING_BINDING_READ_START"
  | "PLAYER_PAIRING_BINDING_READ_OK"
  | "PLAYER_PAIRING_BINDING_READ_ERROR"
  | "PLAYER_PAIRING_PIN_TRANSACTION_START"
  | "PLAYER_PAIRING_PIN_TRANSACTION_OK"
  | "PLAYER_PAIRING_PIN_TRANSACTION_ERROR";

type IdentityResetStage =
  | "binding-initial-read"
  | "owner-identification"
  | "presence-cleanup"
  | "pin-query"
  | "pin-removal"
  | "claim-read"
  | "claim-removal"
  | "binding-transaction"
  | "binding-confirmation-read";

function pairingNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

function pairingErrorField(error: unknown, field: "name" | "code" | "message"): string | undefined {
  if (error instanceof Error && field === "name") {
    return error.name;
  }

  if (error instanceof Error && field === "message") {
    return error.message;
  }

  if (typeof error !== "object" || error === null) {
    return typeof error === "string" && field === "message" ? error : undefined;
  }

  const value = (error as Record<string, unknown>)[field];

  return typeof value === "string" ? value : undefined;
}

function sanitizePairingErrorText(value: string): string {
  return value
    .replace(/(playerBindings|playerPairingCodes)\/[^\s/?#]+/g, "$1/<redacted>")
    .replace(/\b\d{6}\b/g, "<redacted>")
    .replace(/([?&](?:token|access_token|auth|credential|key)=)[^&\s]+/gi, "$1<redacted>")
    .replace(/\b(?:bearer|token)\s+\S+/gi, "<redacted-token>")
    .slice(0, 240);
}

export function sanitizePairingError(error: unknown): {
  name: string;
  code?: string;
  message: string;
} {
  const name = pairingErrorField(error, "name");
  const code = pairingErrorField(error, "code");
  const message = pairingErrorField(error, "message");

  return {
    name: sanitizePairingErrorText(name ?? "Error"),
    ...(code !== undefined ? { code: sanitizePairingErrorText(code) } : {}),
    message: sanitizePairingErrorText(message ?? "Unknown error"),
  };
}

function recordPairingDiagnostic(
  code: PairingDiagnosticCode,
  details: Record<string, unknown>,
): void {
  try {
    recordPlayerDiagnostic(code, details);
  } catch {
    // Diagnostics are observational and must never affect pairing.
  }
}

function recordIdentityResetStep(
  stage: IdentityResetStage,
  result: string,
  details: Record<string, unknown> = {},
): void {
  try {
    recordPlayerDiagnostic("PLAYER_IDENTITY_RESET_STEP", {
      stage,
      result,
      ...details,
    });
  } catch {
    // Reset diagnostics must never affect identity recovery.
  }
}

let cachedAuth: Auth | null = null;

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/**
 * The Player is a separate application from Studio. Its Auth instance is
 * deliberately initialized with browser-local persistence so the Firebase UID
 * remains stable across reloads of the same browser profile.
 */
export function getPlayerAuth(): Auth {
  if (cachedAuth !== null) return cachedAuth;

  const app = getPlayerFirebaseApp();

  try {
    cachedAuth = initializeAuth(app, { persistence: browserLocalPersistence });
  } catch (error) {
    if (errorCode(error) !== "auth/already-initialized") throw error;
    cachedAuth = getAuth(app);
  }

  return cachedAuth;
}

export function normalizePairingPin(value: string): string | null {
  const canonical = value.replace(/\s/g, "");
  return /^\d{6}$/.test(canonical) ? canonical : null;
}

export function formatPairingPin(pin: string): string {
  const canonical = normalizePairingPin(pin);
  if (canonical === null) throw new Error("Pairing PIN must contain six digits.");
  return `${canonical.slice(0, 3)} ${canonical.slice(3)}`;
}

function generatePairingPin(): string {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return String(100_000 + (random[0] ?? 0) % 900_000);
}

function parsePairingRecord(value: unknown): PairingRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.playerUid !== "string" ||
    record.playerUid.length === 0 ||
    typeof record.expiresAt !== "number" ||
    !Number.isFinite(record.expiresAt)
  ) {
    return null;
  }
  return { playerUid: record.playerUid, expiresAt: record.expiresAt };
}

function parseOwnerUid(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const ownerUid = (value as { ownerUid?: unknown }).ownerUid;
  return typeof ownerUid === "string" && ownerUid.length > 0 ? ownerUid : null;
}

function bindingPath(playerUid: string): string {
  return `${PLAYER_BINDINGS_PATH}/${playerUid}`;
}

function pairingCodePath(pin: string): string {
  return `${PLAYER_PAIRING_CODES_PATH}/${pin}`;
}

function pairingClaimPath(playerUid: string): string {
  return `${PLAYER_PAIRING_CLAIMS_PATH}/${playerUid}`;
}

/** Clear only the durable resources and binding owned by this anonymous identity. */
export async function resetPlayerIdentity(database: Database): Promise<void> {
  const auth = getPlayerAuth();
  const restoredUser = await waitForRestoredUser(auth);

  // A previous reset may have completed sign-out but not yet signed in again.
  // With no identity there is no owner to infer; the normal pairing bootstrap
  // will create exactly one fresh anonymous user.
  if (restoredUser === null) return;
  const oldUser = currentAnonymousUser(auth, restoredUser);
  const playerUid = oldUser.uid;
  const lockManager = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (lockManager === undefined) {
    throw new Error("This browser cannot coordinate a safe multi-tab Player reset. Open the Player in a current browser and retry.");
  }

  await lockManager.request(identityResetLockName(playerUid), async () => {
    // Another tab may have completed the reset while this tab waited.
    if (auth.currentUser?.uid !== playerUid) return;
    if (identityResetIsComplete(playerUid)) {
      await waitForChangedIdentity(auth, playerUid);
      return;
    }

    const markerKey = identityResetMarkerKey(playerUid);
    let resetCommitted = false;
    const channel = typeof BroadcastChannel === "undefined"
      ? undefined
      : new BroadcastChannel(IDENTITY_RESET_CHANNEL);
    try {
      localStorage.setItem(markerKey, String(Date.now()));
      const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      if (channel !== undefined) {
        await waitForPlayerTabsToStop(channel, playerUid, requestId);
      }

      recordIdentityResetStep("binding-initial-read", "start");
      const bindingRef = ref(database, bindingPath(playerUid));
      let bindingSnapshot;
      try {
        bindingSnapshot = await get(bindingRef);
      } catch (error) {
        recordIdentityResetStep("binding-initial-read", "error", sanitizePairingError(error));
        throw error;
      }
      const bindingValue = bindingSnapshot.val();
      const ownerUid = parseOwnerUid(bindingValue);
      recordIdentityResetStep("binding-initial-read", "ok", {
        exists: bindingSnapshot.exists(),
        ownerUidValid: ownerUid !== null,
      });
      recordIdentityResetStep("owner-identification", ownerUid === null ? "none" : "valid");
      if (bindingValue !== null && ownerUid === null) {
        throw new Error("The Player binding could not be verified. Try again.");
      }

      if (ownerUid !== null) {
        recordIdentityResetStep("presence-cleanup", "start");
        try {
          await clearPlayerPresence(database, ownerUid, playerUid);
          recordIdentityResetStep("presence-cleanup", "ok");
        } catch (error) {
          recordIdentityResetStep("presence-cleanup", "error", sanitizePairingError(error));
          throw error;
        }
      }

      recordIdentityResetStep("pin-query", "start");
      let codes;
      let codeRecords: unknown;
      try {
        codes = await get(query(
          ref(database, PLAYER_PAIRING_CODES_PATH),
          orderByChild("playerUid"),
          equalTo(playerUid),
        ));
        codeRecords = codes.val();
        const count = typeof codeRecords === "object" && codeRecords !== null
          ? Object.keys(codeRecords).length
          : 0;
        recordIdentityResetStep("pin-query", "ok", { count });
      } catch (error) {
        recordIdentityResetStep("pin-query", "error", sanitizePairingError(error));
        throw error;
      }
      let ownPinCount = 0;
      if (typeof codeRecords === "object" && codeRecords !== null) {
        const removals = Object.entries(codeRecords as Record<string, unknown>)
          .filter(([pin, value]) => /^\d{6}$/.test(pin) && parsePairingRecord(value)?.playerUid === playerUid)
          .map(([pin]) => pairingCodePath(pin));
        ownPinCount = removals.length;
        recordIdentityResetStep("pin-removal", "start", { count: ownPinCount });
        try {
          await Promise.all(removals.map((path) => remove(ref(database, path))));
          recordIdentityResetStep("pin-removal", "ok", { count: ownPinCount });
        } catch (error) {
          recordIdentityResetStep("pin-removal", "error", sanitizePairingError(error));
          throw error;
        }
      }

      const claimRef = ref(database, pairingClaimPath(playerUid));
      recordIdentityResetStep("claim-read", "start");
      let claimSnapshot;
      try {
        claimSnapshot = await get(claimRef);
        recordIdentityResetStep("claim-read", "ok", { exists: claimSnapshot.exists() });
      } catch (error) {
        recordIdentityResetStep("claim-read", "error", sanitizePairingError(error));
        throw error;
      }
      if (claimSnapshot.exists()) {
        recordIdentityResetStep("claim-removal", "start");
        try {
          await remove(claimRef);
          recordIdentityResetStep("claim-removal", "ok");
        } catch (error) {
          recordIdentityResetStep("claim-removal", "error", sanitizePairingError(error));
          throw error;
        }
      }

      let bindingDeleteCommitted = false;
      let bindingCallbackRejectedChangedValue = false;
      if (ownerUid !== null) {
        recordIdentityResetStep("binding-transaction", "start");
        let bindingRemoval: TransactionResult;
        let bindingCallbackAborted = false;
        let bindingStartedWithoutCachedValue = false;
        try {
          bindingRemoval = await runTransaction(
            bindingRef,
            playerBindingRemovalUpdater(bindingValue, (decision) => {
              if (decision === "changed") bindingCallbackAborted = true;
              if (decision === "local-cache-empty") bindingStartedWithoutCachedValue = true;
            }),
            { applyLocally: false },
          );
        } catch (error) {
          recordIdentityResetStep("binding-transaction", "error", sanitizePairingError(error));
          throw error;
        }
        const transactionSnapshotExists = bindingRemoval.snapshot.exists();
        const transactionOwnerUidValid = parseOwnerUid(bindingRemoval.snapshot.val()) !== null;
        bindingDeleteCommitted = bindingRemoval.committed;
        bindingCallbackRejectedChangedValue = bindingCallbackAborted ||
          (!bindingRemoval.committed && transactionOwnerUidValid);
        recordIdentityResetStep("binding-transaction", "result", {
          committed: bindingRemoval.committed,
          snapshotExists: transactionSnapshotExists,
          ownerUidValid: transactionOwnerUidValid,
          callbackAborted: bindingCallbackRejectedChangedValue,
          initialCacheWasEmpty: bindingStartedWithoutCachedValue,
          outcome: bindingRemoval.committed
            ? "committed"
            : bindingCallbackRejectedChangedValue
              ? "callback-aborted-binding-changed"
              : transactionSnapshotExists
                ? "not-committed-binding-present"
                : "not-committed-snapshot-empty",
        });
      }

      recordIdentityResetStep("binding-confirmation-read", "start");
      let confirmedBinding;
      try {
        confirmedBinding = await get(bindingRef);
      } catch (error) {
        recordIdentityResetStep("binding-confirmation-read", "error", sanitizePairingError(error));
        throw error;
      }
      recordIdentityResetStep("binding-confirmation-read", "result", {
        exists: confirmedBinding.exists(),
        ownerUidValid: parseOwnerUid(confirmedBinding.val()) !== null,
        outcome: confirmedBinding.exists()
          ? bindingDeleteCommitted
            ? "binding-reappeared-after-committed-removal"
            : "binding-remains-after-uncommitted-removal"
          : "absent",
      });
      if (confirmedBinding.exists()) {
        const confirmedOwnerUid = parseOwnerUid(confirmedBinding.val());
        if (confirmedOwnerUid === null) {
          throw new Error("The Player binding has an unexpected structure. Try again.");
        }
        if (bindingDeleteCommitted) {
          throw new Error("The Player binding reappeared after removal. Try again.");
        }
        throw new Error(bindingCallbackRejectedChangedValue
          ? "The Player binding changed during reset. Try again."
          : "The Player could not be unpaired. Try again.");
      }

      resetCommitted = true;
      await signOut(auth);
      const credentials = await signInAnonymously(auth);
      if (credentials.user.uid === playerUid) {
        throw new Error("Firebase did not create a new Player identity. Try again.");
      }
      localStorage.setItem(markerKey, `complete:${credentials.user.uid}`);
    } catch (error) {
      if (!resetCommitted) {
        try {
          localStorage.removeItem(markerKey);
        } catch {
          // Best effort marker rollback.
        }
      }
      throw error;
    } finally {
      channel?.close();
    }
  });
}

function waitForChangedIdentity(auth: Auth, oldUid: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let unsubscribe: Unsubscribe | undefined;
    const timeout = setTimeout(() => {
      unsubscribe?.();
      reject(new Error("The other Player tab completed the reset, but this tab has not received the new identity yet. Reload and retry."));
    }, 5_000);
    unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user?.uid === oldUid) return;
      clearTimeout(timeout);
      unsubscribe?.();
      resolve();
    });
  });
}

function waitForPlayerTabsToStop(
  channel: BroadcastChannel,
  playerUid: string,
  requestId: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let quietTimer: ReturnType<typeof setTimeout>;
    const timeout = setTimeout(
      () => finish(new Error("Another Player tab did not stop cleanly. Try again.")),
      2_000,
    );
    const finish = (error?: Error): void => {
      clearTimeout(quietTimer);
      clearTimeout(timeout);
      channel.removeEventListener("message", onMessage);
      if (error === undefined) resolve();
      else reject(error);
    };
    const onMessage = (event: MessageEvent<unknown>): void => {
      if (typeof event.data !== "object" || event.data === null) return;
      const message = event.data as {
        kind?: unknown;
        playerUid?: unknown;
        requestId?: unknown;
        ok?: unknown;
      };
      if (message.kind === "prepared" && message.playerUid === playerUid && message.requestId === requestId) {
        if (message.ok !== true) {
          finish(new Error("Another Player tab could not stop its live resources. Close it and retry."));
          return;
        }
        clearTimeout(quietTimer);
        quietTimer = setTimeout(() => finish(), 150);
      }
    };
    channel.addEventListener("message", onMessage);
    quietTimer = setTimeout(() => finish(), 150);
    channel.postMessage({ kind: "prepare-reset", playerUid, requestId });
  });
}

function readServerTimeOffset(database: Database): Promise<number> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribe: Unsubscribe | undefined;
    let cleanupPending = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const cleanup = (): void => {
      if (timeout !== undefined) {
        clearTimeout(timeout);
        timeout = undefined;
      }

      if (unsubscribe !== undefined) {
        unsubscribe();
        unsubscribe = undefined;
        cleanupPending = false;
        return;
      }

      cleanupPending = true;
    };

    const fail = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Realtime Database server time offset is unavailable."));
    };

    const succeed = (value: number): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    timeout = setTimeout(fail, SERVER_TIME_OFFSET_TIMEOUT_MS);

    try {
      unsubscribe = onValue(
        ref(database, SERVER_TIME_OFFSET_PATH),
        (snapshot) => {
          const value = snapshot.val();
          if (typeof value !== "number" || !Number.isFinite(value)) {
            fail();
            return;
          }

          succeed(value);
        },
        () => fail(),
      );

      if (cleanupPending) {
        const pendingUnsubscribe = unsubscribe;
        unsubscribe = undefined;
        cleanupPending = false;
        pendingUnsubscribe?.();
      }
    } catch {
      fail();
    }
  });
}

async function reservePairingPin(
  database: Database,
  auth: Auth,
  playerUid: string,
  preferredPin?: string,
): Promise<string> {
  const lockManager = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (lockManager === undefined) {
    return reservePairingPinUnlocked(database, auth, playerUid, preferredPin);
  }

  return lockManager.request(identityResetLockName(playerUid), async () => {
    if (auth.currentUser?.uid !== playerUid || identityResetIsMarked(playerUid)) {
      throw new Error("Player pairing was stopped because its identity is being reset.");
    }
    return reservePairingPinUnlocked(database, auth, playerUid, preferredPin);
  });
}

async function reservePairingPinUnlocked(
  database: Database,
  auth: Auth,
  playerUid: string,
  preferredPin?: string,
): Promise<string> {
  const serverTimeOffset = await readServerTimeOffset(database);
  const candidates = new Set<string>();
  if (preferredPin !== undefined) candidates.add(preferredPin);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    candidates.add(generatePairingPin());
  }

  let transactionAttempt = 0;

  for (const pin of candidates) {
    transactionAttempt += 1;
    const pairingRef = ref(database, pairingCodePath(pin));
    const serverNow = Date.now() + serverTimeOffset;
    const expiresAt =
      serverNow + PLAYER_PAIRING_PIN_TTL_MS - PLAYER_PAIRING_PIN_CLOCK_SAFETY_MARGIN_MS;
    const transactionStartedAt = pairingNow();

    recordPairingDiagnostic("PLAYER_PAIRING_PIN_TRANSACTION_START", {
      operation: "pinReservationTransaction",
      attempt: transactionAttempt,
      isAnonymous: auth.currentUser?.isAnonymous === true,
    });

    const result = await runTransaction(
      pairingRef,
      (current) => {
        const existing = parsePairingRecord(current);
        if (
          existing !== null &&
          existing.expiresAt > Date.now() + serverTimeOffset &&
          existing.playerUid !== playerUid
        ) {
          return;
        }

        return { playerUid, expiresAt };
      },
      { applyLocally: false },
    ).then(
      (transactionResult) => {
        recordPairingDiagnostic("PLAYER_PAIRING_PIN_TRANSACTION_OK", {
          operation: "pinReservationTransaction",
          attempt: transactionAttempt,
          committed: transactionResult.committed,
          durationMs: Math.max(0, pairingNow() - transactionStartedAt),
          isAnonymous: auth.currentUser?.isAnonymous === true,
        });

        return transactionResult;
      },
      (error: unknown) => {
        recordPairingDiagnostic("PLAYER_PAIRING_PIN_TRANSACTION_ERROR", {
          operation: "pinReservationTransaction",
          attempt: transactionAttempt,
          durationMs: Math.max(0, pairingNow() - transactionStartedAt),
          error: sanitizePairingError(error),
          isAnonymous: auth.currentUser?.isAnonymous === true,
        });

        throw error;
      },
    );

    if (result.committed === true) return pin;
  }

  throw new Error("Could not reserve a temporary pairing PIN.");
}

function currentAnonymousUser(auth: Auth, user: User | null): User {
  if (user === null || user.isAnonymous !== true) {
    throw new Error("Player identity is not anonymous.");
  }
  if (auth.currentUser?.uid !== user.uid) {
    throw new Error("Player identity changed during initialization.");
  }
  return user;
}

function waitForRestoredUser(auth: Auth): Promise<User | null> {
  return new Promise((resolve) => {
    let unsubscribe: (() => void) | undefined;
    unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe?.();
      resolve(user);
    });
  });
}

/** Start the durable Player identity and its temporary pairing lifecycle. */
export async function startPlayerPairing(
  database: Database,
  onState: (state: PlayerPairingState) => void,
): Promise<PlayerPairingSession> {
  const auth = getPlayerAuth();
  const restoredUser = await waitForRestoredUser(auth);
  const credentials =
    restoredUser === null ? await signInAnonymously(auth) : null;
  const user = currentAnonymousUser(auth, credentials?.user ?? restoredUser);
  const playerUid = user.uid;
  const bindingRef = ref(database, bindingPath(playerUid));
  const bindingReadStartedAt = pairingNow();

  recordPairingDiagnostic("PLAYER_PAIRING_BINDING_READ_START", {
    operation: "bindingRead",
    isAnonymous: auth.currentUser?.isAnonymous === true,
  });

  const bindingSnapshot = await get(bindingRef).then(
    (snapshot) => {
      recordPairingDiagnostic("PLAYER_PAIRING_BINDING_READ_OK", {
        operation: "bindingRead",
        durationMs: Math.max(0, pairingNow() - bindingReadStartedAt),
        isAnonymous: auth.currentUser?.isAnonymous === true,
      });

      return snapshot;
    },
    (error: unknown) => {
      recordPairingDiagnostic("PLAYER_PAIRING_BINDING_READ_ERROR", {
        operation: "bindingRead",
        durationMs: Math.max(0, pairingNow() - bindingReadStartedAt),
        error: sanitizePairingError(error),
        isAnonymous: auth.currentUser?.isAnonymous === true,
      });

      throw error;
    },
  );
  const existingOwnerUid = parseOwnerUid(bindingSnapshot.val());

  let destroyed = false;
  let paired = existingOwnerUid !== null;
  let pairedOwnerUid = existingOwnerUid;
  let pin: string | undefined;
  let renewalTimer: ReturnType<typeof setInterval> | undefined;
  let unsubscribeBinding: Unsubscribe | undefined;
  let unsubscribeAuth: Unsubscribe | undefined;
  let currentState: PlayerPairingState =
    existingOwnerUid === null
      ? { kind: "error", message: "Player pairing is not ready." }
      : { kind: "paired", ownerUid: existingOwnerUid };

  const publish = (state: PlayerPairingState): void => {
    currentState = state;
    if (!destroyed) onState(state);
  };

  function stopRenewal(): void {
    if (renewalTimer === undefined) return;
    clearInterval(renewalTimer);
    renewalTimer = undefined;
  }

  const publishPaired = (ownerUid: string): void => {
    if (paired && pairedOwnerUid === ownerUid) return;
    paired = true;
    pairedOwnerUid = ownerUid;
    pin = undefined;
    stopRenewal();
    publish({ kind: "paired", ownerUid });
  };

  const renew = async (): Promise<void> => {
    if (destroyed || paired || pin === undefined) return;

    const snapshot = await get(bindingRef);
    const ownerUid = parseOwnerUid(snapshot.val());
    if (ownerUid !== null) {
      publishPaired(ownerUid);
      return;
    }

    const nextPin = await reservePairingPin(database, auth, playerUid, pin);
    if (destroyed || identityResetIsMarked(playerUid)) return;
    if (nextPin !== pin) {
      pin = nextPin;
      publish({ kind: "pairing", pin });
    }
  };

  function startRenewal(): void {
    if (renewalTimer !== undefined || paired || destroyed) return;
    renewalTimer = setInterval(() => {
      void renew().catch(() => undefined);
    }, PLAYER_PAIRING_PIN_RENEWAL_MS);
  }

  const publishPairing = async (): Promise<void> => {
    if (destroyed || paired) return;
    pin = await reservePairingPin(database, auth, playerUid, pin);
    if (destroyed || identityResetIsMarked(playerUid)) return;
    publish({ kind: "pairing", pin });
    startRenewal();
  };

  const handleBinding = (snapshot: { val(): unknown }): void => {
    const ownerUid = parseOwnerUid(snapshot.val());
    if (ownerUid !== null) {
      publishPaired(ownerUid);
      return;
    }

    if (!paired) return;

    paired = false;
    pairedOwnerUid = null;
    pin = undefined;
    void publishPairing().catch(() => {
      publish({ kind: "error", message: "Could not restart Player pairing." });
    });
  };

  if (existingOwnerUid === null) {
    await publishPairing();
  }

  unsubscribeBinding = onValue(
    bindingRef,
    handleBinding,
    () => publish({ kind: "error", message: "Could not observe Player pairing." }),
  );

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    stopRenewal();
    unsubscribeBinding?.();
    unsubscribeBinding = undefined;
    unsubscribeAuth?.();
    unsubscribeAuth = undefined;
  };

  unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    if (user?.uid === playerUid && user.isAnonymous) return;
    publish({ kind: "error", message: "Player identity changed. Reload to continue." });
    destroy();
  });

  const state = currentState;
  if (state.kind === "error") throw new Error(state.message);

  return {
    playerUid,
    state,
    destroy,
  };
}
