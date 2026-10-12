"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@web-slideshow/ui";

import { DangerConfirmDialog } from "../app/danger-confirm-dialog";
import { getCurrentNonAnonymousUser } from "../auth/firebase-auth";
import { useStudioI18n } from "../i18n/studio-i18n-context";
import type { ManagedAssetAvailabilityState } from "../persistence/managed-asset-availability";
import styles from "./managed-asset-availability-control.module.css";

type AvailabilityViewState = "idle" | "checking" | ManagedAssetAvailabilityState;

export function ManagedAssetAvailabilityControl({
  pathname,
  compact = false,
  reconciliation,
}: {
  pathname: string | null;
  compact?: boolean;
  reconciliation?: {
    assetName: string;
    associations: readonly string[];
    onComplete: () => void;
  };
}) {
  const { t } = useStudioI18n();
  const [result, setResult] = useState<{
    pathname: string | null;
    state: AvailabilityViewState;
    storeId: string | null;
  }>({ pathname, state: pathname ? "idle" : "unknown", storeId: null });
  const requestRevisionRef = useRef(0);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileError, setReconcileError] = useState(false);

  useEffect(() => {
    requestRevisionRef.current += 1;
  }, [pathname]);

  const currentResult = result.pathname === pathname
    ? result
    : { pathname, state: (pathname ? "idle" : "unknown") as AvailabilityViewState, storeId: null };

  async function checkAvailability(): Promise<void> {
    if (!pathname || currentResult.state === "checking") return;
    const requestRevision = requestRevisionRef.current + 1;
    requestRevisionRef.current = requestRevision;
    setResult({ pathname, state: "checking", storeId: null });
    try {
      const user = getCurrentNonAnonymousUser();
      if (!user || user.isAnonymous) throw new Error("Authentication is unavailable.");
      const response = await fetch("/api/managed-assets/availability", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pathname }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Availability check failed.");
      const result: unknown = await response.json();
      if (typeof result !== "object" || result === null) throw new Error("Invalid availability response.");
      const value = result as Record<string, unknown>;
      const nextState = value.state === "available" || value.state === "missing" || value.state === "unknown"
        ? value.state
        : "unknown";
      if (requestRevisionRef.current !== requestRevision) return;
      setResult({ pathname, state: nextState, storeId: typeof value.storeId === "string" ? value.storeId : null });
    } catch {
      if (requestRevisionRef.current === requestRevision) setResult({ pathname, state: "unknown", storeId: null });
    }
  }

  async function confirmReconciliation(): Promise<void> {
    if (!pathname || state !== "missing" || !storeId || !reconciliation || reconciling) return;
    setReconciling(true);
    setReconcileError(false);
    try {
      const user = getCurrentNonAnonymousUser();
      if (!user || user.isAnonymous) throw new Error("Authentication is unavailable.");
      const response = await fetch("/api/managed-assets/reconcile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pathname, expectedStoreId: storeId }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Managed asset reconciliation failed.");
      const result: unknown = await response.json();
      if (typeof result !== "object" || result === null || typeof (result as Record<string, unknown>).alreadyReconciled !== "boolean") {
        throw new Error("Invalid reconciliation response.");
      }
      setReconcileOpen(false);
      setResult({ pathname, state: "unknown", storeId: null });
      reconciliation.onComplete();
    } catch {
      setReconcileError(true);
    } finally {
      setReconciling(false);
    }
  }

  const state = currentResult.state;
  const storeId = currentResult.storeId;
  const stateLabel = state === "idle"
    ? t("managedAssetAvailability.notChecked")
    : state === "checking"
      ? t("managedAssetAvailability.checking")
      : t(`managedAssetAvailability.${state}`);

  return (
    <span className={`${styles.availability} ${compact ? styles.compact : ""}`}>
      {pathname ? (
        <Button size="compact" disabled={state === "checking"} onClick={() => void checkAvailability()}>
          {state === "checking" ? t("managedAssetAvailability.checking") : t("managedAssetAvailability.check")}
        </Button>
      ) : null}
      <span
        role="status"
        data-managed-asset-availability={state === "idle" ? "unverified" : state}
        title={storeId ? t("managedAssetAvailability.checkedStore", { storeId }) : undefined}
      >
        {stateLabel}
        {storeId ? <small className={styles.storeId}>{t("managedAssetAvailability.storeId", { storeId })}</small> : null}
      </span>
      {state === "missing" && storeId && reconciliation ? (
        <Button size="compact" variant="danger" disabled={reconciling} onClick={() => { setReconcileError(false); setReconcileOpen(true); }}>
          {t("managedAssetAvailability.reconcile")}
        </Button>
      ) : null}
      {reconcileError ? <span role="alert">{t("managedAssetAvailability.reconcileFailed")}</span> : null}
      {reconcileOpen && reconciliation ? (
        <DangerConfirmDialog
          title={t("managedAssetAvailability.reconcileConfirmTitle")}
          message={t("managedAssetAvailability.reconcileConfirmMessage", {
            name: reconciliation.assetName,
            storeId: storeId ?? "",
            associations: reconciliation.associations.join(", ") || t("managedAssetAvailability.noAssociations"),
          })}
          confirmLabel={t("managedAssetAvailability.reconcile")}
          busyConfirmLabel={t("managedAssetAvailability.reconciling")}
          cancelLabel={t("customLibrary.cancel")}
          busy={reconciling}
          error={reconcileError ? t("managedAssetAvailability.reconcileFailed") : undefined}
          onCancel={() => { setReconcileOpen(false); setReconcileError(false); }}
          onConfirm={() => void confirmReconciliation()}
        />
      ) : null}
    </span>
  );
}
