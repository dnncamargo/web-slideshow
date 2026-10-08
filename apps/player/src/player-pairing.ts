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
  playerUid: string,
  preferredPin?: string,
): Promise<string> {
  const candidates = new Set<string>();
  if (preferredPin !== undefined) candidates.add(preferredPin);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    candidates.add(generatePairingPin());
  }

  for (const pin of candidates) {
    const pairingRef = ref(database, pairingCodePath(pin));
    const expiresAt = Date.now() + PLAYER_PAIRING_PIN_TTL_MS;
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
  const bindingSnapshot = await get(bindingRef);
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

  const publishPaired = (ownerUid: string): void => {
    if (paired && pairedOwnerUid === ownerUid) return;
    paired = true;
    pairedOwnerUid = ownerUid;
    if (renewalTimer !== undefined) clearInterval(renewalTimer);
    publish({ kind: "paired", ownerUid });
  };

  const handleBinding = (snapshot: { val(): unknown }): void => {
    const ownerUid = parseOwnerUid(snapshot.val());
    if (ownerUid !== null) publishPaired(ownerUid);
  };

  if (existingOwnerUid === null) {
    pin = await reservePairingPin(database, playerUid);
    publish({ kind: "pairing", pin });
  }

  unsubscribeBinding = onValue(
    bindingRef,
    handleBinding,
    () => publish({ kind: "error", message: "Could not observe Player pairing." }),
  );

  const renew = async (): Promise<void> => {
    if (destroyed || paired || pin === undefined) return;

    const snapshot = await get(bindingRef);
    const ownerUid = parseOwnerUid(snapshot.val());
    if (ownerUid !== null) {
      publishPaired(ownerUid);
      return;
    }

    const nextPin = await reservePairingPin(database, playerUid, pin);
    if (nextPin !== pin) {
      pin = nextPin;
      publish({ kind: "pairing", pin });
    }
  };

  if (!paired) {
    renewalTimer = setInterval(() => {
      void renew().catch(() => undefined);
    }, PLAYER_PAIRING_PIN_RENEWAL_MS);
  }

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
