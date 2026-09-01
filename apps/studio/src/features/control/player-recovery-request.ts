import { ref, runTransaction, serverTimestamp, type Database } from "firebase/database";

import { getCurrentNonAnonymousUser } from "../auth/firebase-auth";

export const PLAYER_RECOVERY_REQUEST_PATH = "live/playerRecoveryRequest";

export interface PlayerRecoveryRequest {
  activationRevision: number;
  currentVersionId: string;
  revision: number;
  targetBootId: string;
  action: "reload";
  requestedAt: number;
}

const nonNegativeInteger = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
const positiveInteger = (value: unknown): value is number => nonNegativeInteger(value) && value >= 1;
const text = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

export function parsePlayerRecoveryRequest(value: unknown): PlayerRecoveryRequest | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 6 || !nonNegativeInteger(record.activationRevision) || !text(record.currentVersionId) || !positiveInteger(record.revision) || !text(record.targetBootId) || record.action !== "reload" || !nonNegativeInteger(record.requestedAt)) return null;
  return { activationRevision: record.activationRevision, currentVersionId: record.currentVersionId.trim(), revision: record.revision, targetBootId: record.targetBootId.trim(), action: "reload", requestedAt: record.requestedAt };
}

export async function requestPlayerReload(
  database: Database,
  activationRevision: number,
  currentVersionId: string,
  targetBootId: string,
): Promise<PlayerRecoveryRequest> {
  const version = currentVersionId.trim();
  const bootId = targetBootId.trim();
  if (!nonNegativeInteger(activationRevision) || version === "" || bootId === "") throw new Error("Player reload requires an active matching Player.");
  if (getCurrentNonAnonymousUser() === null) throw new Error("Control requires an authenticated user.");
  const requestRef = ref(database, PLAYER_RECOVERY_REQUEST_PATH);
  const outcome = await runTransaction(requestRef, (current) => {
    const previous = parsePlayerRecoveryRequest(current);
    const revision = previous !== null && previous.activationRevision === activationRevision && previous.currentVersionId === version ? previous.revision + 1 : 1;
    return { activationRevision, currentVersionId: version, revision, targetBootId: bootId, action: "reload", requestedAt: serverTimestamp() };
  });
  const request = parsePlayerRecoveryRequest(outcome.snapshot.val());
  if (!outcome.committed || request === null) throw new Error("Could not request Player reload.");
  return request;
}
