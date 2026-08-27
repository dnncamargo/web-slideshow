"use client";

import type { PresentationPaletteColor } from "@powershow/document-schema";
import { useCallback, useEffect, useRef, useState } from "react";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
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

const PREVIEW_COLOR_LIMIT = 6;

export function CustomResourcesWorkspace({
  customLibraryPaletteRepository = getDefaultCustomLibraryPaletteRepository(),
  presentationColors,
}: CustomResourcesWorkspaceProps) {
  const { t } = useStudioI18n();
  const [loadState, setLoadState] = useState<PaletteLoadState>({ kind: "loading" });
  const requestRevisionRef = useRef(0);

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
            <h3 className={styles.groupTitle}>{t("customResources.customLibrary")}</h3>
            {loadState.kind === "loading" ? (
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
