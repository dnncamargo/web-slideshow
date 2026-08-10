import type { SlideLayoutPreset } from "./slide-operations";

import type { StudioMessageKey } from "@/features/i18n/studio-i18n";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "./editor-workspace.module.css";

// ============================================================
// BEGIN: SLIDE LAYOUT PICKER PROPS
// ============================================================

interface SlideLayoutPickerProps {
  value: SlideLayoutPreset;

  onChange: (preset: SlideLayoutPreset) => void;

  onCreate: () => void;

  onCancel: () => void;
}

// ============================================================
// END: SLIDE LAYOUT PICKER PROPS
// ============================================================

// ============================================================
// BEGIN: DEFINIÇÃO DOS PRESETS VISUAIS
// ============================================================

const presets: {
  id: SlideLayoutPreset;

  label: StudioMessageKey;

  description: StudioMessageKey;
}[] = [
  {
    id: "blank",

    label: "slides.layout.blank",

    description: "slides.layout.blankDescription",
  },

  {
    id: "centered",

    label: "slides.layout.centered",

    description: "slides.layout.centeredDescription",
  },

  {
    id: "title-content",

    label: "slides.layout.titleContent",

    description: "slides.layout.titleContentDescription",
  },

  {
    id: "two-columns",

    label: "slides.layout.twoColumns",

    description: "slides.layout.twoColumnsDescription",
  },

  {
    id: "three-columns",

    label: "slides.layout.threeColumns",

    description: "slides.layout.threeColumnsDescription",
  },

  {
    id: "title-two-columns",

    label: "slides.layout.titleTwoColumns",

    description: "slides.layout.titleTwoColumnsDescription",
  },
];

// ============================================================
// END: DEFINIÇÃO DOS PRESETS VISUAIS
// ============================================================

// ============================================================
// BEGIN: PREVIEW DO PRESET
//
// O preview é puramente visual.
//
// Ele não representa o documento e não participa do renderer.
// ============================================================

function LayoutPreview({ preset }: { preset: SlideLayoutPreset }) {
  switch (preset) {
    case "blank":
      return <div className={styles.layoutPreviewBlank} />;

    case "centered":
      return (
        <div className={styles.layoutPreviewCentered}>
          <span />
          <span />
        </div>
      );

    case "title-content":
      return (
        <div className={styles.layoutPreviewTitleContent}>
          <span className={styles.layoutPreviewTitle} />

          <span className={styles.layoutPreviewContent} />
        </div>
      );

    case "two-columns":
      return (
        <div className={styles.layoutPreviewColumns}>
          <span />
          <span />
        </div>
      );

    case "three-columns":
      return (
        <div className={styles.layoutPreviewThreeColumns}>
          <span />
          <span />
          <span />
        </div>
      );

    case "title-two-columns":
      return (
        <div className={styles.layoutPreviewTitleColumns}>
          <span className={styles.layoutPreviewTitle} />

          <div>
            <span />
            <span />
          </div>
        </div>
      );
  }
}

// ============================================================
// END: PREVIEW DO PRESET
// ============================================================

// ============================================================
// BEGIN: SLIDE LAYOUT PICKER
// ============================================================

export function SlideLayoutPicker({
  value,
  onChange,
  onCreate,
  onCancel,
}: SlideLayoutPickerProps) {
  const { t } = useStudioI18n();

  return (
    <div className={styles.layoutPicker}>
      {/* ==========================================================
    BEGIN: PICKER HEADER
    ========================================================== */}

      <div className={styles.layoutPickerHeader}>
        <span>{t("slides.chooseLayout")}</span>
      </div>

      {/* ==========================================================
    END: PICKER HEADER
    ========================================================== */}

      <div className={styles.layoutPresetGrid}>
        {presets.map((preset) => {
          const selected = preset.id === value;

          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={selected}
              className={
                selected ? styles.layoutPresetSelected : styles.layoutPreset
              }
              onClick={() => {
                onChange(preset.id);
              }}
            >
              <div className={styles.layoutPreview}>
                <LayoutPreview preset={preset.id} />
              </div>

              <div className={styles.layoutPresetText}>
                <strong>
                  <span>{t(preset.label)}</span>
                </strong>

                <span>{t(preset.description)}</span>
              </div>
            </button>
          );
        })}
      </div>
      {/* ==========================================================
    BEGIN: PICKER ACTIONS
    ========================================================== */}

      <div className={styles.layoutPickerActions}>
        <button
          type="button"
          className={styles.layoutCancelButton}
          onClick={onCancel}
        >
          <span>{t("slides.cancel")}</span>
        </button>

        <button
          type="button"
          className={styles.layoutCreateButton}
          onClick={onCreate}
        >
          <span>{t("slides.create")}</span>
        </button>
      </div>

      {/* ==========================================================
    END: PICKER ACTIONS
    ========================================================== */}
    </div>
  );
}

// ============================================================
// END: SLIDE LAYOUT PICKER
// ============================================================
