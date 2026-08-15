import {
  get,
  onValue,
  ref,
  remove,
  runTransaction,
  type DataSnapshot,
  type Database,
} from "firebase/database";

import { getRealtimeDatabaseOrNull } from "./realtime-db";
import { FirebaseAuthenticationError } from "../persistence/persistence-errors";
import { getCurrentNonAnonymousUser } from "../auth/firebase-auth";

export interface LiveCurrent {
  publicationId: string;
  currentVersionId: string;
  revision: number;
}

export type LiveState =
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "active"; live: LiveCurrent }
  | { kind: "error" };

const LIVE_PATH = "live/current";

function requireAuth() {
  const user = getCurrentNonAnonymousUser();
  if (!user) throw new FirebaseAuthenticationError("Authentication required.");
}

function isNonNegativeInteger(value: unknown): boolean {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function parseLiveCurrent(snapshot: DataSnapshot): LiveCurrent | null {
  const val = snapshot.val();
  if (typeof val !== "object" || val === null) return null;
  const v = val as Record<string, unknown>;
  if (typeof v.publicationId !== "string" || !v.publicationId.trim()) return null;
  if (typeof v.currentVersionId !== "string" || !v.currentVersionId.trim()) return null;
  if (!isNonNegativeInteger(v.revision)) return null;
  return {
    publicationId: v.publicationId.trim(),
    currentVersionId: v.currentVersionId.trim(),
    revision: v.revision as number,
  };
}

export async function readLiveCurrent(): Promise<LiveCurrent | null> {
  const db = getRealtimeDatabaseOrNull();
  if (!db) return null;
  const snapshot = await get(ref(db, LIVE_PATH));
  return snapshot.exists() ? parseLiveCurrent(snapshot) : null;
}

export function subscribeLiveCurrent(
  onState: (state: LiveState) => void,
): (() => void) | null {
  const db = getRealtimeDatabaseOrNull();
  if (!db) return null;

  onState({ kind: "loading" });

  const unsubscribe = onValue(
    ref(db, LIVE_PATH),
    (snapshot) => {
      if (!snapshot.exists()) {
        onState({ kind: "none" });
        return;
      }
      const live = parseLiveCurrent(snapshot);
      if (live) {
        onState({ kind: "active", live });
      } else {
        onState({ kind: "error" });
      }
    },
    () => {
      onState({ kind: "error" });
    },
  );

  return unsubscribe;
}

export async function activateLivePresentation(
  publicationId: string,
  currentVersionId: string,
): Promise<void> {
  requireAuth();
  const db = getRealtimeDatabaseOrNull();
  if (!db) throw new Error("Realtime Database is not configured.");

  const trimmedPublicationId = publicationId.trim();
  const trimmedCurrentVersionId = currentVersionId.trim();

  if (trimmedPublicationId === "") {
    throw new Error("Activation requires a publicationId.");
  }
  if (trimmedCurrentVersionId === "") {
    throw new Error("Activation requires a currentVersionId.");
  }

  const liveRef = ref(db, LIVE_PATH);

  await runTransaction(liveRef, (current) => {
    const baseline = parseLiveCurrent({ val: () => current } as unknown as DataSnapshot);
    return {
      publicationId: trimmedPublicationId,
      currentVersionId: trimmedCurrentVersionId,
      revision: baseline ? baseline.revision + 1 : 1,
    };
  });
}

export async function endLivePresentation(): Promise<void> {
  requireAuth();
  const db = getRealtimeDatabaseOrNull();
  if (!db) return;
  await remove(ref(db, LIVE_PATH));
}
