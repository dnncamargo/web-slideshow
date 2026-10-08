import { get, ref, remove, runTransaction, type Database } from "firebase/database";

import { getCurrentNonAnonymousUser } from "../auth/firebase-auth";

export const PLAYER_BINDINGS_PATH = "playerBindings";
export const PLAYER_PAIRING_CODES_PATH = "playerPairingCodes";
export const PLAYER_PAIRING_CLAIMS_PATH = "playerPairingClaims";
export const PLAYER_PAIRING_CLAIM_TTL_MS = 15_000;

export interface PlayerPairingClaim {
  playerUid: string;
  ownerUid: string;
}

interface PairingRecord {
  playerUid: string;
  expiresAt: number;
}

interface PairingClaimRecord {
  pin: string;
  ownerUid: string;
  expiresAt: number;
}

export function normalizePairingPin(value: string): string | null {
  const canonical = value.replace(/\s/g, "");
  return /^\d{6}$/.test(canonical) ? canonical : null;
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

function bindingPath(playerUid: string): string {
  return `${PLAYER_BINDINGS_PATH}/${playerUid}`;
}

function pairingCodePath(pin: string): string {
  return `${PLAYER_PAIRING_CODES_PATH}/${pin}`;
}

function pairingClaimPath(playerUid: string): string {
  return `${PLAYER_PAIRING_CLAIMS_PATH}/${playerUid}`;
}

function parsePairingClaim(value: unknown): PairingClaimRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.pin !== "string" ||
    normalizePairingPin(record.pin) !== record.pin ||
    typeof record.ownerUid !== "string" ||
    record.ownerUid.length === 0 ||
    typeof record.expiresAt !== "number" ||
    !Number.isFinite(record.expiresAt)
  ) {
    return null;
  }
  return {
    pin: record.pin,
    ownerUid: record.ownerUid,
    expiresAt: record.expiresAt,
  };
}

/** Claim an unowned Player by its short-lived human-enterable PIN. */
export async function claimPlayerByPin(
  database: Database,
  value: string,
): Promise<PlayerPairingClaim> {
  const pin = normalizePairingPin(value);
  if (pin === null) {
    throw new Error("Enter the six-digit Player PIN.");
  }

  const owner = getCurrentNonAnonymousUser();
  if (owner === null) {
    throw new Error("Control requires an authenticated non-anonymous user.");
  }

  const codeRef = ref(database, pairingCodePath(pin));
  const codeSnapshot = await get(codeRef);
  const pairing = parsePairingRecord(codeSnapshot.val());
  if (pairing === null || pairing.expiresAt <= Date.now()) {
    throw new Error("That Player PIN is invalid or expired.");
  }

  const claimRef = ref(database, pairingClaimPath(pairing.playerUid));
  const claimExpiresAt = Math.min(
    pairing.expiresAt,
    Date.now() + PLAYER_PAIRING_CLAIM_TTL_MS,
  );
  const claimResult = await runTransaction(
    claimRef,
    (current) => {
      const existing = parsePairingClaim(current);
      if (
        existing !== null &&
        existing.expiresAt > Date.now() &&
        existing.ownerUid !== owner.uid
      ) {
        return;
      }
      return {
        pin,
        ownerUid: owner.uid,
        expiresAt: claimExpiresAt,
      } satisfies PairingClaimRecord;
    },
    { applyLocally: false },
  );

  if (claimResult.committed !== true) {
    throw new Error("That Player is currently being claimed.");
  }

  const bindingRef = ref(database, bindingPath(pairing.playerUid));
  const result = await runTransaction(
    bindingRef,
    (current) => {
      if (current !== null) return;
      return { ownerUid: owner.uid };
    },
    { applyLocally: false },
  );

  if (result.committed !== true) {
    try {
      await remove(claimRef);
    } catch (error) {
      console.error("Control: could not remove the failed Player claim.", error);
    }
    throw new Error("That Player is already paired.");
  }

  try {
    await remove(codeRef);
  } catch (error) {
    console.error("Control: could not remove the consumed Player PIN.", error);
  }
  try {
    await remove(claimRef);
  } catch (error) {
    // Binding is the durable authority. A failed cleanup leaves only a
    // temporary proof which expires and cannot reassign the Player.
    console.error("Control: could not remove the consumed Player claim.", error);
  }

  return { playerUid: pairing.playerUid, ownerUid: owner.uid };
}
