"use client";

import type { Color } from "@powershow/document-schema";
import { useId, useState } from "react";

import { LiteralColorInput } from "@/features/editor/color/literal-color-input";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import type {
  CustomLibraryPaletteColor,
  CustomLibraryPaletteDraft,
} from "./custom-library-palette";
import { parseCustomLibraryPaletteDraft } from "./custom-library-palette-schema";

import styles from "./custom-library-palette-editor.module.css";

export type CustomLibraryPaletteEditorMode = "create" | "edit" | "copy";

export interface CustomLibraryPaletteEditorProps {
  mode: CustomLibraryPaletteEditorMode;
  initialPalette?: CustomLibraryPaletteDraft;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (palette: CustomLibraryPaletteDraft) => void;
  onCancel: () => void;
}

interface EditableColor extends CustomLibraryPaletteColor {
  editorKey: string;
}

function cloneColors(
  colors: readonly CustomLibraryPaletteColor[] | undefined,
  keyPrefix: string,
): EditableColor[] {
  return (colors ?? []).map((color, index) => ({
    name: color.name,
    value: color.value,
    editorKey: `${keyPrefix}-${index}`,
  }));
}

export function CustomLibraryPaletteEditor({
  mode,
  initialPalette,
  submitting = false,
  error = null,
  onSubmit,
  onCancel,
}: CustomLibraryPaletteEditorProps) {
  const { t } = useStudioI18n();
  const editorId = useId();
  const [lastMode, setLastMode] = useState(mode);
  const [lastInitialPalette, setLastInitialPalette] = useState(initialPalette);
  const [name, setName] = useState(initialPalette?.name ?? "");
  const [description, setDescription] = useState(initialPalette?.description ?? "");
  const [nextKey, setNextKey] = useState(0);
  const [colors, setColors] = useState<EditableColor[]>(() => cloneColors(initialPalette?.colors, editorId));

  if (mode !== lastMode || initialPalette !== lastInitialPalette) {
    setLastMode(mode);
    setLastInitialPalette(initialPalette);
    setName(initialPalette?.name ?? "");
    setDescription(initialPalette?.description ?? "");
    setNextKey(0);
    setColors(cloneColors(initialPalette?.colors, editorId));
  }

  const hasValidName = name.trim().length > 0;
  const hasValidColors = colors.length > 0 && colors.every((color) => color.name.trim().length > 0);
  const canSubmit = !submitting && hasValidName && hasValidColors;

  function updateColor(editorKey: string, update: (color: EditableColor) => EditableColor) {
    setColors((current) => current.map((color) => color.editorKey === editorKey ? update(color) : color));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    const candidate: {
      name: string;
      description?: string;
      colors: CustomLibraryPaletteColor[];
    } = {
      name: name.trim(),
      colors: colors.map((color) => ({
        name: color.name.trim(),
        value: color.value,
      })),
    };
    const trimmedDescription = description.trim();
    if (trimmedDescription) candidate.description = trimmedDescription;

    const validated = parseCustomLibraryPaletteDraft(candidate);
    onSubmit(validated);
  }

  const titleKey = mode === "create"
    ? "customLibrary.paletteEditor.newTitle"
    : mode === "edit"
      ? "customLibrary.paletteEditor.editTitle"
      : "customLibrary.paletteEditor.copyTitle";
  const submitKey = mode === "create"
    ? "customLibrary.paletteEditor.create"
    : mode === "edit"
      ? "customLibrary.paletteEditor.saveChanges"
      : "customLibrary.paletteEditor.createCopy";

  return (
    <form className={styles.editor} onSubmit={handleSubmit}>
      <h2>{t(titleKey)}</h2>
      <label className={styles.field}>
        <span>{t("customLibrary.paletteEditor.name")}</span>
        <input value={name} onChange={(event) => setName(event.target.value)} disabled={submitting} />
      </label>
      <label className={styles.field}>
        <span>{t("customLibrary.paletteEditor.description")}</span>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} disabled={submitting} rows={2} />
      </label>
      <div className={styles.colors}>
        <span>{t("customLibrary.paletteEditor.colors")}</span>
        <div className={styles.colorList}>
          {colors.map((color) => (
            <div className={styles.colorRow} key={color.editorKey}>
              <label className={styles.colorName}>
                <span>{t("customLibrary.paletteEditor.colorName")}</span>
                <input
                  aria-label={t("customLibrary.paletteEditor.colorName")}
                  value={color.name}
                  onChange={(event) => updateColor(color.editorKey, (current) => ({ ...current, name: event.target.value }))}
                  disabled={submitting}
                />
              </label>
              <LiteralColorInput
                id={`custom-library-palette-color-${color.editorKey}`}
                name={t("customLibrary.paletteEditor.colorName")}
                value={color.value}
                disabled={submitting}
                onChange={(value: Color) => updateColor(color.editorKey, (current) => ({ ...current, value }))}
              />
              <button className={styles.remove} type="button" disabled={submitting} onClick={() => setColors((current) => current.filter((item) => item.editorKey !== color.editorKey))}>
                {t("customLibrary.paletteEditor.removeColor")}
              </button>
            </div>
          ))}
        </div>
        <button className={styles.add} type="button" disabled={submitting} onClick={() => {
          setColors((current) => [...current, { name: "", value: "#f8fafc", editorKey: `${editorId}-new-${nextKey}` }]);
          setNextKey((current) => current + 1);
        }}>
          {t("customLibrary.paletteEditor.addColor")}
        </button>
      </div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <div className={styles.actions}>
        <button type="button" disabled={submitting} onClick={onCancel}>{t("customLibrary.paletteEditor.cancel")}</button>
        <button type="submit" disabled={!canSubmit}>{t(submitKey)}</button>
      </div>
    </form>
  );
}
