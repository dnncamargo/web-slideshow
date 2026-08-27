"use client";

import type { Color, PresentationPaletteColor } from "@powershow/document-schema";
import { useCallback, useEffect, useRef, useState } from "react";

import { LiteralColorInput } from "@/features/editor/color/literal-color-input";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import type { CustomLibraryPaletteDraft } from "@/features/custom-library/custom-library-palette";
import type {
  CustomLibraryPaletteRecord,
  CustomLibraryPaletteRepository,
} from "@/features/custom-library/custom-library-palette-repository";
import type { CustomLibraryPaletteAddOutcome } from "@/features/custom-library/custom-library-palette-add-picker";
import { getDefaultCustomLibraryPaletteRepository } from "@/features/persistence/custom-library-palette-repository-instance";

import styles from "./custom-resources-workspace.module.css";

interface CustomResourcesWorkspaceProps {
  customLibraryPaletteRepository?: CustomLibraryPaletteRepository;
  presentationColors: readonly PresentationPaletteColor[];
  onAddLibraryPalette: (palette: CustomLibraryPaletteDraft) => CustomLibraryPaletteAddOutcome;
  onAddPresentationColor: (name: string, value: Color) => void;
  onRemovePresentationColor: (id: string) => void;
}

type PaletteLoadState =
  | { kind: "loading" }
  | { kind: "ready"; records: CustomLibraryPaletteRecord[] }
  | { kind: "error" };

const PREVIEW_COLOR_LIMIT = 6;

export function CustomResourcesWorkspace({
  customLibraryPaletteRepository = getDefaultCustomLibraryPaletteRepository(),
  presentationColors,
  onAddLibraryPalette,
  onAddPresentationColor,
  onRemovePresentationColor,
}: CustomResourcesWorkspaceProps) {
  const { t } = useStudioI18n();
  const [loadState, setLoadState] = useState<PaletteLoadState>({ kind: "loading" });
  const [chooserOpen, setChooserOpen] = useState(false);
  const [colorName, setColorName] = useState("");
  const [colorValue, setColorValue] = useState<Color>("#ffffff");
  const requestRevisionRef = useRef(0);

  const loadPalettes = useCallback(() => {
    const requestRevision = requestRevisionRef.current + 1;
    requestRevisionRef.current = requestRevision;
    setLoadState({ kind: "loading" });
    void Promise.resolve()
      .then(() => customLibraryPaletteRepository.listPalettes())
      .then((records) => {
        if (requestRevision === requestRevisionRef.current) setLoadState({ kind: "ready", records });
      })
      .catch(() => {
        if (requestRevision === requestRevisionRef.current) setLoadState({ kind: "error" });
      });
  }, [customLibraryPaletteRepository]);

  useEffect(() => {
    void Promise.resolve().then(loadPalettes);
    return () => {
      requestRevisionRef.current += 1;
    };
  }, [loadPalettes]);

  function addIndividualColor(): void {
    const name = colorName.trim();
    if (!name) return;
    onAddPresentationColor(name, colorValue);
    setColorName("");
  }

  return (
    <aside className={styles.workspace} aria-label={t("editor.customResources")}>
      <div className={styles.header}><span>{t("customResources.title")}</span></div>

      <div className={styles.content}>
        <section className={styles.section} aria-labelledby="custom-resources-palettes">
          <h2 id="custom-resources-palettes" className={styles.sectionTitle}>{t("customResources.palettes")}</h2>

          <div className={styles.group}>
            <div className={styles.groupHeader}>
              <h3 className={styles.groupTitle}>{t("customResources.customLibrary")}</h3>
              <button type="button" className={styles.resourceAction} onClick={() => setChooserOpen((open) => !open)}>
                {chooserOpen ? t("customResources.closePaletteChooser") : t("customResources.addPalette")}
              </button>
            </div>
            {chooserOpen ? <MasterPaletteChooser loadState={loadState} onRetry={loadPalettes} onAdd={onAddLibraryPalette} /> : null}
          </div>

          {chooserOpen ? (
            <div className={styles.group}>
              <h3 className={styles.groupTitle}>{t("customResources.addToPresentation")}</h3>
              <div className={styles.localColorAdd}>
                <label className={styles.localColorName}>
                  <span>{t("customResources.colorName")}</span>
                  <input data-presentation-color-name-input value={colorName} onChange={(event) => setColorName(event.target.value)} />
                </label>
                <LiteralColorInput
                  id="custom-resources-literal-color"
                  name={t("customResources.color")}
                  value={colorValue}
                  onChange={setColorValue}
                />
                <button type="button" className={styles.resourceAction} disabled={!colorName.trim()} onClick={addIndividualColor}>
                  {t("customResources.addColor")}
                </button>
              </div>
            </div>
          ) : null}

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
                  <div className={styles.localColorList}>
                    {presentationColors.map((color) => (
                      <div key={color.id} className={styles.localColorRow} data-presentation-color-row>
                        <span>{color.name}</span>
                        <code>{color.value}</code>
                        <button type="button" className={styles.removeColor} aria-label={t("customResources.removePresentationColor", { name: color.name })} onClick={() => onRemovePresentationColor(color.id)}>×</button>
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

function MasterPaletteChooser({
  loadState,
  onRetry,
  onAdd,
}: {
  loadState: PaletteLoadState;
  onRetry: () => void;
  onAdd: (palette: CustomLibraryPaletteDraft) => CustomLibraryPaletteAddOutcome;
}) {
  const { t } = useStudioI18n();

  if (loadState.kind === "loading") return <p className={styles.status}>{t("customResources.loadingPalettes")}</p>;
  if (loadState.kind === "error") return <div className={styles.statusGroup}><p className={styles.status} role="alert">{t("customResources.loadFailed")}</p><button type="button" className={styles.retryButton} onClick={onRetry}>{t("customResources.retry")}</button></div>;
  if (loadState.records.length === 0) return <p className={styles.status}>{t("customResources.noLibraryPalettes")}</p>;

  return (
    <div className={styles.masterPaletteList}>
      {loadState.records.map(({ id, palette }) => (
        <div key={id} className={styles.masterPaletteRow} data-custom-resource-palette={id}>
          <strong>{palette.name}</strong>
          <ColorSwatches colors={palette.colors} />
          <span className={styles.masterPaletteCount}>{t("customResources.colorCount", { count: palette.colors.length })}</span>
          <button type="button" className={styles.resourceAction} aria-label={t("customResources.addMasterPalette", { name: palette.name })} onClick={() => onAdd(palette)}>+</button>
        </div>
      ))}
    </div>
  );
}

function ColorSwatches({ colors }: { colors: readonly { name: string; value: string }[] }) {
  const visibleColors = colors.slice(0, PREVIEW_COLOR_LIMIT);
  const remainingCount = colors.length - visibleColors.length;

  return (
    <div className={styles.swatches} aria-hidden="true">
      {visibleColors.map((color, index) => <span key={`${color.name}-${index}`} className={styles.swatch} data-palette-swatch style={{ backgroundColor: color.value }} />)}
      {remainingCount > 0 ? <span className={styles.moreSwatches}>+{remainingCount}</span> : null}
    </div>
  );
}
