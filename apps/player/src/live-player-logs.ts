import { onValue, ref, type Database } from "firebase/database";

export const PLAYER_LOGS_PATH = "live/playerLogs";

export interface PlayerLogsRecord {
  activationRevision: number;
  enabled: boolean;
}

function isActivationRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

/** Parses only the exact activation-scoped desired diagnostics state. */
export function parsePlayerLogs(value: unknown): PlayerLogsRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 2 || !isActivationRevision(record.activationRevision) || typeof record.enabled !== "boolean") return null;
  return { activationRevision: record.activationRevision, enabled: record.enabled };
}

/** Builds the local Player URL; only this Player owns its origin and routing. */
export function buildPlayerLogsUrl(currentHref: string, enabled: boolean): string {
  const url = new URL(currentHref);
  if (enabled) url.searchParams.set("logs", "true");
  else url.search = "";
  return url.toString();
}

export interface PlayerLogsNavigation {
  replace(url: string): void;
}

/** Subscribes to absolute desired state and navigates only when its local URL differs. */
export function subscribePlayerLogs(
  database: Database,
  activationRevision: number,
  location: { href: string },
  navigation: PlayerLogsNavigation = window.location,
): () => void {
  let tornDown = false;
  const unsubscribe = onValue(ref(database, PLAYER_LOGS_PATH), (snapshot) => {
    if (tornDown) return;
    const record = parsePlayerLogs(snapshot.val());
    if (record === null || record.activationRevision !== activationRevision) return;
    const target = buildPlayerLogsUrl(location.href, record.enabled);
    if (target !== location.href) navigation.replace(target);
  });
  return () => {
    tornDown = true;
    unsubscribe();
  };
}
