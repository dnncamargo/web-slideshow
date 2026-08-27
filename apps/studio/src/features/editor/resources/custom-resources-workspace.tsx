"use client";

import type { PresentationPaletteColor } from "@powershow/document-schema";
import { useCallback, useEffect, useRef, useState } from "react";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import { CustomLibraryPaletteEditor } from "@/features/custom-library/custom-library-palette-editor";
import type { CustomLibraryPaletteDraft } from "@/features/custom-library/custom-library-palette";
import type {
  CustomLibraryPaletteRecord,
  CustomLibraryPaletteRepository,
} from "@/features/custom-library/custom-library-palette-repository";
import { getDefaultCustomLibraryPaletteRepository } from "@/features/persistence/custom-library-palette-repository-instance";

import styles from "./custom-resources-workspace.module.css";

interface CustomResourcesWorkspaceProps {
  customLibraryPaletteRepository?: CustomLibraryPaletteRepository;
  presentationColors: readonly PresentationPaletteColor[];
}

type PaletteLoadState =
  | { kind: "loading" }
  | { kind: "ready"; records: CustomLibraryPaletteRecord[] }
  | { kind: "error" };

type PaletteAuthoringState =
  | { kind: "create" }
  | { kind: "edit"; recordId: string; initialPalette: CustomLibraryPaletteDraft }
  | { kind: "copy"; initialPalette: CustomLibraryPaletteDraft }
  | null;

type PendingWrite = "saving" | "deleting" | null;

const PREVIEW_COLOR_LIMIT = 6;

export function CustomResourcesWorkspace({
  customLibraryPaletteRepository = getDefaultCustomLibraryPaletteRepository(),
  presentationColors,
}: CustomResourcesWorkspaceProps) {
  const { t } = useStudioI18n();
  const [loadState, setLoadState] = useState<PaletteLoadState>({ kind: "loading" });
  const [authoring, setAuthoring] = useState<PaletteAuthoringState>(null);
  const [authoringError, setAuthoringError] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingWrite, setPendingWrite] = useState<PendingWrite>(null);
  const requestRevisionRef = useRef(0);
  const mountedRef = useRef(true);
  const writeRevisionRef = useRef(0);

  const loadPalettes = useCallback(() => {
    const requestRevision = requestRevisionRef.current + 1;
    requestRevisionRef.current = requestRevision;
    setLoadState({ kind: "loading" });
    void Promise.resolve()
      .then(() => customLibraryPaletteRepository.listPalettes())
      .then((records) => {
        if (requestRevision !== requestRevisionRef.current) {
          return;
        }
        setLoadState({ kind: "ready", records });
      })
      .catch(() => {
        if (requestRevision !== requestRevisionRef.current) {
          return;
        }
        setLoadState({ kind: "error" });
      });
  }, [customLibraryPaletteRepository]);

  useEffect(() => {
    void Promise.resolve().then(loadPalettes);
    return () => {
      requestRevisionRef.current += 1;
    };
  }, [loadPalettes]);

  useEffect(() => () => {
    mountedRef.current = false;
    writeRevisionRef.current += 1;
  }, []);

  const beginAuthoring = useCallback((next: PaletteAuthoringState) => {
    setAuthoringError(null);
    setDeleteTargetId(null);
    setDeleteError(null);
    setAuthoring(next);
  }, []);

  function handlePaletteSubmit(draft: CustomLibraryPaletteDraft): void {
    if (!authoring || pendingWrite) return;

    const currentAuthoring = authoring;
    const writeRevision = writeRevisionRef.current + 1;
    writeRevisionRef.current = writeRevision;
    setAuthoringError(null);
    setPendingWrite("saving");

    void (async () => {
      try {
        if (currentAuthoring.kind === "edit") {
          await customLibraryPaletteRepository.updatePalette(currentAuthoring.recordId, draft);
          if (!mountedRef.current || writeRevision !== writeRevisionRef.current) return;
          setLoadState((current) => current.kind === "ready"
            ? { kind: "ready", records: current.records.map((record) => record.id === currentAuthoring.recordId ? { ...record, palette: draft } : record) }
            : current);
        } else {
          const id = await customLibraryPaletteRepository.savePalette(draft);
          if (!mountedRef.current || writeRevision !== writeRevisionRef.current) return;
          setLoadState((current) => current.kind === "ready"
            ? { kind: "ready", records: [...current.records, { id, palette: draft }] }
            : current);
        }
        setAuthoring(null);
      } catch {
        if (!mountedRef.current || writeRevision !== writeRevisionRef.current) return;
        setAuthoringError(currentAuthoring.kind === "edit"
          ? t("customResources.updateFailed")
          : t("customResources.saveFailed"));
      } finally {
        if (mountedRef.current && writeRevision === writeRevisionRef.current) {
          setPendingWrite(null);
        }
      }
    })();
  }

  function handleDelete(id: string): void {
    if (pendingWrite) return;
    setDeleteError(null);
    setDeleteTargetId(id);
  }

  function confirmDelete(): void {
    if (!deleteTargetId || pendingWrite) return;
    const targetId = deleteTargetId;
    const writeRevision = writeRevisionRef.current + 1;
    writeRevisionRef.current = writeRevision;
    setDeleteError(null);
    setPendingWrite("deleting");

    void customLibraryPaletteRepository.deletePalette(targetId)
      .then(() => {
        if (!mountedRef.current || writeRevision !== writeRevisionRef.current) return;
        setLoadState((current) => current.kind === "ready"
          ? { kind: "ready", records: current.records.filter((record) => record.id !== targetId) }
          : current);
        setDeleteTargetId(null);
      })
      .catch(() => {
        if (!mountedRef.current || writeRevision !== writeRevisionRef.current) return;
        setDeleteError(t("customResources.deleteFailed"));
      })
      .finally(() => {
        if (mountedRef.current && writeRevision === writeRevisionRef.current) {
          setPendingWrite(null);
        }
      });
  }

  const activePalette = authoring?.kind === "edit" || authoring?.kind === "copy"
    ? authoring.initialPalette
    : undefined;

  return (
    <aside className={styles.workspace} aria-label={t("editor.customResources")}>
      <div className={styles.header}>
        <span>{t("customResources.title")}</span>
      </div>

      <div className={styles.content}>
        <section className={styles.section} aria-labelledby="custom-resources-palettes">
          <h2 id="custom-resources-palettes" className={styles.sectionTitle}>
            {t("customResources.palettes")}
          </h2>

          <div className={styles.group}>
            <div className={styles.groupHeader}>
              <h3 className={styles.groupTitle}>{t("customResources.customLibrary")}</h3>
              {loadState.kind === "ready" && !authoring ? (
                <button type="button" className={styles.resourceAction} disabled={Boolean(pendingWrite)} onClick={() => beginAuthoring({ kind: "create" })}>
                  {t("customResources.newPalette")}
                </button>
              ) : null}
            </div>
            {authoring ? (
              <>
                {pendingWrite === "saving" ? <p className={styles.status}>{t("customResources.savingPalette")}</p> : null}
                <CustomLibraryPaletteEditor
                  mode={authoring.kind}
                  initialPalette={activePalette}
                  submitting={pendingWrite === "saving"}
                  error={authoringError}
                  onSubmit={handlePaletteSubmit}
                  onCancel={() => {
                    if (pendingWrite) return;
                    setAuthoringError(null);
                    setAuthoring(null);
                  }}
                />
              </>
            ) : loadState.kind === "loading" ? (
              <p className={styles.status}>{t("customResources.loadingPalettes")}</p>
            ) : loadState.kind === "error" ? (
              <div className={styles.statusGroup}>
                <p className={styles.status} role="alert">{t("customResources.loadFailed")}</p>
                <button type="button" className={styles.retryButton} onClick={loadPalettes}>
                  {t("customResources.retry")}
                </button>
              </div>
            ) : loadState.records.length === 0 ? (
              <p className={styles.status}>{t("customResources.noLibraryPalettes")}</p>
            ) : (
              <div className={styles.paletteList}>
                {loadState.records.map(({ id, palette }) => (
                  <div key={id} className={styles.paletteCard} data-custom-resource-palette={id}>
                    <div className={styles.paletteCardHeader}>
                      <strong>{palette.name}</strong>
                      <span>{t("customResources.colorCount", { count: palette.colors.length })}</span>
                    </div>
                    <ColorSwatches colors={palette.colors} />
                    {palette.description ? <p className={styles.description}>{palette.description}</p> : null}
                    <div className={styles.cardActions}>
                      <button type="button" className={styles.resourceAction} disabled={Boolean(pendingWrite)} aria-label={t("customResources.editPalette", { name: palette.name })} onClick={() => beginAuthoring({ kind: "edit", recordId: id, initialPalette: palette })}>{t("customResources.edit")}</button>
                      <button type="button" className={styles.resourceAction} disabled={Boolean(pendingWrite)} aria-label={t("customResources.copyPalette", { name: palette.name })} onClick={() => beginAuthoring({ kind: "copy", initialPalette: palette })}>{t("customResources.copy")}</button>
                      {deleteTargetId === id ? (
                        <div className={styles.confirmation}>
                          <span>{t("customResources.deleteConfirm", { name: palette.name })}</span>
                          <button type="button" className={styles.resourceAction} disabled={Boolean(pendingWrite)} onClick={() => { setDeleteTargetId(null); setDeleteError(null); }}>{t("customResources.cancel")}</button>
                          <button type="button" className={styles.dangerAction} disabled={Boolean(pendingWrite)} onClick={confirmDelete}>{pendingWrite === "deleting" ? t("customResources.deletingPalette") : t("customResources.confirmDelete")}</button>
                        </div>
                      ) : (
                        <button type="button" className={styles.resourceAction} disabled={Boolean(pendingWrite)} aria-label={t("customResources.deletePalette", { name: palette.name })} onClick={() => handleDelete(id)}>{t("customResources.delete")}</button>
                      )}
                    </div>
                    {deleteTargetId === id && deleteError ? <p className={styles.error} role="alert">{deleteError}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.group}>
            <h3 className={styles.groupTitle}>{t("customResources.thisPresentation")}</h3>
            {presentationColors.length === 0 ? (
              <p className={styles.status}>{t("customResources.noPresentationColors")}</p>
            ) : (
              <div className={styles.paletteList}>
                <div className={styles.paletteCard} data-presentation-palette>
                  <div className={styles.paletteCardHeader}>
                    <strong>{t("customResources.thisPresentation")}</strong>
                    <span>{t("customResources.colorCount", { count: presentationColors.length })}</span>
                  </div>
                  <ColorSwatches colors={presentationColors} />
                  <div className={styles.localColorList}>
                    {presentationColors.map((color) => (
                      <div key={color.id} className={styles.localColorRow}>
                        <span>{color.name}</span>
                        <code>{color.value}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}

function ColorSwatches({
  colors,
}: {
  colors: readonly { name: string; value: string }[];
}) {
  const visibleColors = colors.slice(0, PREVIEW_COLOR_LIMIT);
  const remainingCount = colors.length - visibleColors.length;

  return (
    <div className={styles.swatches} aria-hidden="true">
      {visibleColors.map((color) => (
        <span key={`${color.name}-${color.value}`} className={styles.swatch} data-palette-swatch style={{ backgroundColor: color.value }} />
      ))}
      {remainingCount > 0 ? <span className={styles.moreSwatches}>+{remainingCount}</span> : null}
    </div>
  );
}
