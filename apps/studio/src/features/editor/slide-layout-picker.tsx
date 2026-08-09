import type { SlideLayoutPreset } from "./slide-operations";

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

  label: string;

  description: string;
}[] = [
  {
    id: "blank",

    label: "Blank",

    description: "Empty slide",
  },

  {
    id: "centered",

    label: "Centered",

    description: "Centered content",
  },

  {
    id: "title-content",

    label: "Title + Content",

    description: "Title and body",
  },

  {
    id: "two-columns",

    label: "Two Columns",

    description: "50 / 50 layout",
  },

  {
    id: "three-columns",

    label: "Three Columns",

    description: "Three sections",
  },

  {
    id: "title-two-columns",

    label: "Title + 2 Cols",

    description: "Title with columns",
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
  return (
    <div className={styles.layoutPicker}>
      {/* ==========================================================
    BEGIN: PICKER HEADER
    ========================================================== */}

      <div className={styles.layoutPickerHeader}>
        <span>Choose layout</span>
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
                <strong>{preset.label}</strong>

                <span>{preset.description}</span>
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
          Cancel
        </button>

        <button
          type="button"
          className={styles.layoutCreateButton}
          onClick={onCreate}
        >
          + New
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
