"use client";

import { useEffect, useRef, useState } from "react";

import { getDefaultCustomLibraryRepository } from "@/features/persistence/custom-library-repository-instance";
import {
  ELEMENT_TYPE_MESSAGE_KEYS,
  type StudioTranslate,
} from "@/features/i18n/studio-i18n";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import type {
  CustomLibraryItemRecord,
  CustomLibraryRepository,
} from "./custom-library-repository";
import type { CustomLibraryItemDraft } from "./custom-library-item";
import type { CustomLibraryItemApplyFailureReason } from "./custom-library-item-apply";

import styles from "../editor/editor-workspace.module.css";

export type CustomLibraryApplyOutcome =
  | { ok: true }
  | { ok: false; reason: CustomLibraryItemApplyFailureReason };

interface CustomLibraryApplyPickerProps {
  repository?: CustomLibraryRepository;
  onApply: (item: CustomLibraryItemDraft) => CustomLibraryApplyOutcome;
}

function rootTypeLabel(
  item: CustomLibraryItemRecord,
  t: StudioTranslate,
): string {
  return t(ELEMENT_TYPE_MESSAGE_KEYS[item.item.root.type]);
}

export function CustomLibraryApplyPicker({
  repository = getDefaultCustomLibraryRepository(),
  onApply,
}: CustomLibraryApplyPickerProps) {
  const { t } = useStudioI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<CustomLibraryItemRecord[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadFailed, setHasLoadFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [feedback, setFeedback] = useState<"applied" | "failed" | "unsupported" | null>(null);
  const isActiveRef = useRef(true);

  useEffect(() => () => {
    isActiveRef.current = false;
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    let isRequestActive = true;
    setIsLoading(true);
    setHasLoadFailed(false);
    setFeedback(null);

    repository.listItems()
      .then((nextItems) => {
        if (!isRequestActive || !isActiveRef.current) return;
        setItems(nextItems);
        setSelectedId(null);
      })
      .catch(() => {
        if (!isRequestActive || !isActiveRef.current) return;
        setItems(null);
        setHasLoadFailed(true);
        setSelectedId(null);
      })
      .finally(() => {
        if (isRequestActive && isActiveRef.current) setIsLoading(false);
      });

    return () => {
      isRequestActive = false;
    };
  }, [isOpen, reloadToken, repository]);

  const selectedItem = items?.find((record) => record.id === selectedId) ?? null;

  function handleApply() {
    if (!selectedItem) return;

    const outcome = onApply(selectedItem.item);
    setFeedback(
      outcome.ok
        ? "applied"
        : outcome.reason === "unsupported-create-type"
          ? "unsupported"
          : "failed",
    );
  }

  return (
    <div className={styles.customLibraryApply}>
      <button
        className={styles.customLibrarySaveButton}
        type="button"
        data-custom-library-apply
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        {t("customLibrary.applyOpen")}
      </button>
      {isOpen && (
        <div className={styles.customLibraryApplyPanel}>
          {isLoading && (
            <p className={styles.customLibraryApplyStatus} role="status">
              {t("customLibrary.applyLoading")}
            </p>
          )}
          {!isLoading && hasLoadFailed && (
            <>
              <p className={`${styles.customLibraryApplyStatus} ${styles.customLibrarySaveError}`} role="alert">
                {t("customLibrary.applyLoadFailed")}
              </p>
              <button type="button" onClick={() => setReloadToken((current) => current + 1)}>
                {t("customLibrary.applyRetry")}
              </button>
            </>
          )}
          {!isLoading && !hasLoadFailed && items !== null && items.length === 0 && (
            <p className={styles.customLibraryApplyStatus}>{t("customLibrary.applyEmpty")}</p>
          )}
          {!isLoading && !hasLoadFailed && items && items.length > 0 && (
            <>
              <ul className={styles.customLibraryApplyList}>
                {items.map((record) => (
                  <li key={record.id}>
                    <button
                      type="button"
                      className={styles.customLibraryApplyItem}
                      aria-pressed={selectedId === record.id}
                      onClick={() => {
                        setSelectedId(record.id);
                        setFeedback(null);
                      }}
                    >
                      <strong>{record.item.name}</strong>
                      <span>{rootTypeLabel(record, t)}</span>
                      {record.item.description ? <span>{record.item.description}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" disabled={!selectedItem} onClick={handleApply}>
                {t("customLibrary.apply")}
              </button>
            </>
          )}
          {feedback === "applied" && <p className={styles.customLibraryApplyStatus} role="status">{t("customLibrary.applySuccess")}</p>}
          {feedback === "failed" && <p className={`${styles.customLibraryApplyStatus} ${styles.customLibrarySaveError}`} role="alert">{t("customLibrary.applyFailed")}</p>}
          {feedback === "unsupported" && <p className={`${styles.customLibraryApplyStatus} ${styles.customLibrarySaveError}`} role="alert">{t("customLibrary.unsupportedCreate")}</p>}
        </div>
      )}
    </div>
  );
}
