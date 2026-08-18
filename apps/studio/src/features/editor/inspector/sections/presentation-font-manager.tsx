import { useState } from "react";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import type { FontManagerSource } from "@/features/fonts/web-font-types";

import { normalizeFontFamily } from "../../font-resource-helpers";
import styles from "../../editor-workspace.module.css";

import { getControlName } from "../inspector-helpers";
import type { FontResourceControls } from "../inspector-types";

import { GoogleFontImportControl } from "./google-font-import-control";
import { ManualFontControl } from "./manual-font-control";
import { RegisteredFontsControl } from "./registered-fonts-control";
import { WebFontSearchControl } from "./web-font-search-control";

interface PresentationFontManagerProps extends FontResourceControls {
  id: string;
  selectedElementId: string;
  selectedFontFamily: string | undefined;
  onApplyFontFamily: (family: string) => void;
}

interface AddedFontState {
  elementId: string;
  family: string;
}

function isFontManagerSource(value: string): value is FontManagerSource {
  return (
    value === "fontsource" || value === "google-fonts" || value === "manual"
  );
}

export function PresentationFontManager({
  id,
  selectedElementId,
  selectedFontFamily,
  onApplyFontFamily,
  fontResources,
  onAddFontFace,
  onRemoveFontFace,
  isFontFamilyInUse,
}: PresentationFontManagerProps) {
  const { t } = useStudioI18n();
  const [source, setSource] = useState<FontManagerSource>("fontsource");
  const [addedFont, setAddedFont] = useState<AddedFontState>();

  // The added state is scoped to the element it was created for. A different
  // selection must never inherit the "added"/"applied" feedback of a
  // previously selected element: the panel only renders for the matching
  // elementId, and the applied claim always derives from the canonical
  // style.fontFamily of the currently selected element.
  const activeAddedFont =
    addedFont?.elementId === selectedElementId ? addedFont : undefined;
  const addedFamilyApplied =
    activeAddedFont !== undefined &&
    normalizeFontFamily(selectedFontFamily ?? "") ===
      normalizeFontFamily(activeAddedFont.family);

  return (
    <div
      id={id}
      className={styles.fontManager}
      role="region"
      aria-label={t("inspector.presentationFonts")}
    >
      <strong className={styles.fontManagerTitle}>
        {t("inspector.presentationFonts")}
      </strong>

      <label className={styles.field}>
        <span>{t("inspector.webFonts.source")}</span>

        <select
          id="presentation-font-source"
          name={getControlName("presentation", "FontSource")}
          value={source}
          onChange={(event) => {
            if (isFontManagerSource(event.target.value)) {
              setSource(event.target.value);
            }
          }}
        >
          <option value="fontsource">
            {t("inspector.webFonts.fontsource")}
          </option>
          <option value="google-fonts">
            {t("inspector.webFonts.googleFonts")}
          </option>
          <option value="manual">{t("inspector.webFonts.manual")}</option>
        </select>
      </label>

      {source === "fontsource" && (
        <WebFontSearchControl
          key="fontsource"
          provider="fontsource"
          fontResources={fontResources}
          onAddFontFace={onAddFontFace}
          onFontAdded={(family) => {
            setAddedFont({ elementId: selectedElementId, family });
          }}
        />
      )}

      {source === "google-fonts" && (
        <div className={styles.fontSourcePanel}>
          <WebFontSearchControl
            key="google-fonts"
            provider="google-fonts"
            fontResources={fontResources}
            onAddFontFace={onAddFontFace}
            onFontAdded={(family) => {
              setAddedFont({ elementId: selectedElementId, family });
            }}
          />

          <GoogleFontImportControl
            fontResources={fontResources}
            onAddFontFace={onAddFontFace}
            onFontAdded={(family) => {
              setAddedFont({ elementId: selectedElementId, family });
            }}
          />
        </div>
      )}

      {source === "manual" && (
        <ManualFontControl
          fontResources={fontResources}
          onAddFontFace={onAddFontFace}
          onFontAdded={(family) => {
            setAddedFont({ elementId: selectedElementId, family });
          }}
        />
      )}

      {activeAddedFont && (
        <div className={styles.fontApplySuggestion} role="status" aria-live="polite">
          <span>
            {t("inspector.fontAddedToPresentation", {
              family: activeAddedFont.family,
            })}
          </span>

          {addedFamilyApplied ? (
            <strong>{t("inspector.appliedToSelectedText")}</strong>
          ) : (
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => {
                onApplyFontFamily(activeAddedFont.family);
              }}
            >
              {t("inspector.applyToSelectedText")}
            </button>
          )}
        </div>
      )}

      <RegisteredFontsControl
        fontResources={fontResources}
        onRemoveFontFace={onRemoveFontFace}
        isFontFamilyInUse={isFontFamilyInUse}
      />
    </div>
  );
}