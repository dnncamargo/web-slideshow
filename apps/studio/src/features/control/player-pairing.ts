import { get, ref, remove, runTransaction, type Database } from "firebase/database";

import { getCurrentNonAnonymousUser } from "../auth/firebase-auth";

export const PLAYER_BINDINGS_PATH = "playerBindings";
export const PLAYER_PAIRING_CODES_PATH = "playerPairingCodes";

export interface PlayerPairingClaim {
  playerUid: string;
  ownerUid: string;
}

interface PairingRecord {
  playerUid: string;
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
    throw new Error("That Player is already paired.");
  }

  try {
    await remove(codeRef);
  } catch (error) {
    // Binding is the durable authority. A failed cleanup leaves only a
    // temporary credential which will expire and cannot reassign the Player.
    console.error("Control: could not remove the consumed Player PIN.", error);
  }

  return { playerUid: pairing.playerUid, ownerUid: owner.uid };
}
