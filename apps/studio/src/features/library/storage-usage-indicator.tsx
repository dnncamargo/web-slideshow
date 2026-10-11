"use client";

import { useEffect, useRef, useState } from "react";

import { useStudioI18n } from "../i18n/studio-i18n-context";
import { useStudioAuth } from "../auth/studio-auth-provider";
import styles from "./presentation-library.module.css";

interface UsageResponse {
  scope: "owner";
  objectCount: number;
  bytesUsed: number;
  measuredAt: string;
  quotaStatus: "unknown";
}

type UsageState =
  | { kind: "idle" | "loading" | "unavailable"; usage: null; ownerId: string | null }
  | { kind: "ready" | "stale"; usage: UsageResponse; ownerId: string };

function isUsageResponse(value: unknown): value is UsageResponse {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const objectCount = record.objectCount;
  const bytesUsed = record.bytesUsed;
  return (
    record.scope === "owner" &&
    typeof objectCount === "number" &&
    Number.isSafeInteger(objectCount) &&
    typeof bytesUsed === "number" &&
    Number.isSafeInteger(bytesUsed) &&
    objectCount >= 0 &&
    bytesUsed >= 0 &&
    typeof record.measuredAt === "string" &&
    record.quotaStatus === "unknown"
  );
}

function formatBytes(bytes: number, locale: string): string {
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${units[unitIndex]}`;
}

function formatMeasuredAt(value: string, locale: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function StorageUsageIndicator({
  enabled,
  refreshKey = 0,
}: {
  enabled: boolean;
  refreshKey?: number;
}) {
  const { locale, t } = useStudioI18n();
  const { user } = useStudioAuth();
  const [state, setState] = useState<UsageState>({ kind: "idle", usage: null, ownerId: null });
  const requestRef = useRef(0);
  const userId = user?.uid ?? null;

  useEffect(() => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    const activeUser = user;

    if (!enabled || activeUser === null) {
      return;
    }

    if (state.ownerId !== userId) {
      queueMicrotask(() => {
        if (requestRef.current === request) setState({ kind: "loading", usage: null, ownerId: userId });
      });
    } else {
      queueMicrotask(() => {
        if (requestRef.current === request) {
          setState((current) => current.usage
            ? { kind: "stale", usage: current.usage, ownerId: userId ?? "" }
            : { kind: "loading", usage: null, ownerId: userId });
        }
      });
    }

    const previousMeasurement = state.usage?.measuredAt;
    void (async () => {
      try {
        const token = await activeUser.getIdToken();
        const response = await fetch("/api/managed-assets/usage", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!response.ok) throw new Error("usage unavailable");
        const body: unknown = await response.json();
        if (!isUsageResponse(body)) throw new Error("invalid usage response");
        if (requestRef.current !== request) return;
        setState({
          kind: previousMeasurement !== undefined && previousMeasurement === body.measuredAt
            ? "stale"
            : "ready",
          usage: body,
          ownerId: activeUser.uid,
        });
      } catch {
        if (requestRef.current !== request) return;
        setState((current) => current.usage
          ? { kind: "stale", usage: current.usage, ownerId: activeUser.uid }
          : { kind: "unavailable", usage: null, ownerId: activeUser.uid });
      }
    })();
    return () => {
      if (requestRef.current === request) requestRef.current += 1;
    };
    // The Firebase User object may be recreated without an auth identity change;
    // the UID is the intentional request boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, refreshKey, userId]);

  if (
    !enabled ||
    user === null ||
    state.kind === "idle" ||
    state.ownerId !== userId
  ) return null;

  const statusLabel = state.kind === "loading"
    ? t("customLibrary.storage.loading")
    : state.kind === "unavailable"
      ? t("customLibrary.storage.unavailable")
      : state.kind === "stale"
        ? t("customLibrary.storage.stale")
        : null;

  return (
    <aside className={styles.storageUsage} data-state={state.kind} aria-live="polite">
      <span className={styles.storageUsageTitle}>{t("customLibrary.storage.title")}</span>
      {state.usage ? (
        <>
          <span>{t("customLibrary.storage.used", { value: formatBytes(state.usage.bytesUsed, locale) })}</span>
          <span>{t("customLibrary.storage.objects", { count: state.usage.objectCount })}</span>
          <span>{t("customLibrary.storage.limitUnknown")}</span>
          <span className={styles.storageUsageMeasured}>
            {t("customLibrary.storage.measuredAt", { value: formatMeasuredAt(state.usage.measuredAt, locale) })}
          </span>
        </>
      ) : null}
      {statusLabel ? <span className={styles.storageUsageStatus}>{statusLabel}</span> : null}
    </aside>
  );
}
