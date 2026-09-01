import { onValue, ref, type Database } from "firebase/database";

export const PLAYER_RECOVERY_REQUEST_PATH = "live/playerRecoveryRequest";

export interface PlayerRecoveryRequest {
  activationRevision: number;
  currentVersionId: string;
  revision: number;
  targetBootId: string;
  action: "reload";
  requestedAt: number;
}

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
const isPositiveInteger = (value: unknown): value is number =>
  isNonNegativeInteger(value) && value >= 1;
const isText = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

/** Parses only the exact, single-action recovery command shape. */
export function parsePlayerRecoveryRequest(value: unknown): PlayerRecoveryRequest | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 6) return null;
  if (!isNonNegativeInteger(record.activationRevision) || !isText(record.currentVersionId) || !isPositiveInteger(record.revision) || !isText(record.targetBootId) || record.action !== "reload" || !isNonNegativeInteger(record.requestedAt)) return null;
  return {
    activationRevision: record.activationRevision,
    currentVersionId: record.currentVersionId.trim(),
    revision: record.revision,
    targetBootId: record.targetBootId.trim(),
    action: "reload",
    requestedAt: record.requestedAt,
  };
}

/** Produces a same-origin reload URL without changing Player routing semantics. */
export function buildPlayerReloadUrl(currentHref: string, activationRevision: number, requestRevision: number): string {
  const url = new URL(currentHref);
  url.searchParams.set("_psreload", `${activationRevision}-${requestRevision}`);
  return url.toString();
}

export interface PlayerRecoveryNavigation {
  replace(url: string): void;
}

/** Observes only commands addressed to this specific Player boot. */
export function subscribePlayerRecoveryRequest(
  database: Database,
  activationRevision: number,
  currentVersionId: string,
  bootId: string,
  location: { href: string },
  navigation: PlayerRecoveryNavigation = window.location,
): () => void {
  let highestHandledRevision = 0;
  let tornDown = false;
  const unsubscribe = onValue(
    ref(database, PLAYER_RECOVERY_REQUEST_PATH),
    (snapshot) => {
      if (tornDown) return;
      const request = parsePlayerRecoveryRequest(snapshot.val());
      if (request === null || request.activationRevision !== activationRevision || request.currentVersionId !== currentVersionId || request.targetBootId !== bootId || request.revision <= highestHandledRevision) return;
      highestHandledRevision = request.revision;
      navigation.replace(buildPlayerReloadUrl(location.href, activationRevision, request.revision));
    },
    () => undefined,
  );
  return () => {
    tornDown = true;
    unsubscribe();
  };
}
