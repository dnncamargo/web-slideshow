"use client";

import { useEffect, useRef, useState } from "react";

import { getDefaultCustomLibraryPaletteRepository } from "../persistence/custom-library-palette-repository-instance";
import { useStudioI18n } from "../i18n/studio-i18n-context";
import type { CustomLibraryPaletteDraft } from "./custom-library-palette";
import type { CustomLibraryPaletteRecord, CustomLibraryPaletteRepository } from "./custom-library-palette-repository";
import styles from "../editor/editor-workspace.module.css";

export type CustomLibraryPaletteAddOutcome = { ok: true } | { ok: false; reason: string };

interface CustomLibraryPaletteAddPickerProps {
  isOpen: boolean;
  repository?: CustomLibraryPaletteRepository;
  onAdd: (palette: CustomLibraryPaletteDraft) => CustomLibraryPaletteAddOutcome;
  onCancel: () => void;
}

export function CustomLibraryPaletteAddPicker({
  isOpen,
  repository = getDefaultCustomLibraryPaletteRepository(),
  onAdd,
  onCancel,
}: CustomLibraryPaletteAddPickerProps) {
  const { t } = useStudioI18n();
  const [records, setRecords] = useState<CustomLibraryPaletteRecord[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [feedback, setFeedback] = useState<"added" | "failed" | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const addingRef = useRef(false);
  const [reloadToken, setReloadToken] = useState(0);
  const activeRef = useRef(true);

  useEffect(() => () => { activeRef.current = false; }, []);

  useEffect(() => {
    if (!isOpen) return;
    let requestActive = true;
    queueMicrotask(() => {
      if (!requestActive || !activeRef.current) return;
      setIsLoading(true);
      setLoadFailed(false);
      setFeedback(null);
    });
    repository.listPalettes().then((next) => {
      if (!requestActive || !activeRef.current) return;
      setRecords(next);
      setSelectedId(null);
    }).catch(() => {
      if (!requestActive || !activeRef.current) return;
      setRecords(null);
      setSelectedId(null);
      setLoadFailed(true);
    }).finally(() => {
      if (requestActive && activeRef.current) setIsLoading(false);
    });
    return () => { requestActive = false; };
  }, [isOpen, reloadToken, repository]);

  const selected = records?.find((record) => record.id === selectedId) ?? null;

  function handleAdd() {
    if (!selected || addingRef.current || feedback === "added") return;
    addingRef.current = true;
    setIsAdding(true);
    try {
      const result = onAdd(selected.palette);
      setFeedback(result.ok ? "added" : "failed");
    } finally {
      addingRef.current = false;
      setIsAdding(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className={styles.customLibraryApplyPanel}>
      {isLoading ? <p className={styles.customLibraryApplyStatus} role="status">{t("customLibrary.palette.loading")}</p> : null}
      {!isLoading && loadFailed ? (
        <>
          <p className={`${styles.customLibraryApplyStatus} ${styles.customLibrarySaveError}`} role="alert">{t("customLibrary.palette.loadFailed")}</p>
          <button type="button" onClick={() => setReloadToken((current) => current + 1)}>{t("customLibrary.palette.retry")}</button>
        </>
      ) : null}
      {!isLoading && !loadFailed && records?.length === 0 ? <p className={styles.customLibraryApplyStatus}>{t("customLibrary.palette.empty")}</p> : null}
      {!isLoading && !loadFailed && records && records.length > 0 ? (
        <>
          <ul className={styles.customLibraryApplyList}>
            {records.map((record) => (
              <li key={record.id}>
                <button type="button" className={styles.customLibraryApplyItem} aria-pressed={record.id === selectedId} onClick={() => { setSelectedId(record.id); setFeedback(null); }}>
                  <span className={styles.customLibraryPalettePickerSwatches} aria-hidden="true">
                    {record.palette.colors.slice(0, 5).map((color, index) => <span key={`${color.name}-${index}`} style={{ backgroundColor: color.value }} />)}
                  </span>
                  <strong>{record.palette.name}</strong>
                  <span>{t("customLibrary.palette.colorsCount", { count: record.palette.colors.length })}</span>
                  {record.palette.description ? <span>{record.palette.description}</span> : null}
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.customLibraryPalettePickerActions}>
            <button type="button" onClick={onCancel}>{t("customLibrary.palette.close")}</button>
            <button type="button" disabled={!selected || isAdding || feedback === "added"} onClick={handleAdd}>{t("customLibrary.palette.addToPresentation")}</button>
          </div>
        </>
      ) : !isLoading && !loadFailed ? <button type="button" onClick={onCancel}>{t("customLibrary.palette.close")}</button> : null}
      {feedback === "added" ? <p className={styles.customLibraryApplyStatus} role="status">{t("customLibrary.palette.added")}</p> : null}
      {feedback === "failed" ? <p className={`${styles.customLibraryApplyStatus} ${styles.customLibrarySaveError}`} role="alert">{t("customLibrary.palette.addFailed")}</p> : null}
    </div>
  );
}
