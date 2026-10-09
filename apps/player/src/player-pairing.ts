import {
  browserLocalPersistence,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
  type User,
} from "firebase/auth";
import {
  get,
  onValue,
  ref,
  runTransaction,
  type Database,
  type Unsubscribe,
} from "firebase/database";

import { getPlayerFirebaseApp } from "./realtime-db";
import { recordPlayerDiagnostic } from "./player-diagnostics";

export const PLAYER_BINDINGS_PATH = "playerBindings";
export const PLAYER_PAIRING_CODES_PATH = "playerPairingCodes";
export const PLAYER_PAIRING_PIN_TTL_MS = 60_000;
export const PLAYER_PAIRING_PIN_RENEWAL_MS = 30_000;

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

function sanitizePairingError(error: unknown): {
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

async function reservePairingPin(
  database: Database,
  auth: Auth,
  playerUid: string,
  preferredPin?: string,
): Promise<string> {
  const candidates = new Set<string>();
  if (preferredPin !== undefined) candidates.add(preferredPin);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    candidates.add(generatePairingPin());
  }

  let transactionAttempt = 0;

  for (const pin of candidates) {
    transactionAttempt += 1;
    const pairingRef = ref(database, pairingCodePath(pin));
    const expiresAt = Date.now() + PLAYER_PAIRING_PIN_TTL_MS;
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
          existing.expiresAt > Date.now() &&
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

  const state = currentState;
  if (state.kind === "error") throw new Error(state.message);

  return {
    playerUid,
    state,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      if (renewalTimer !== undefined) clearInterval(renewalTimer);
      unsubscribeBinding?.();
    },
  };
}
