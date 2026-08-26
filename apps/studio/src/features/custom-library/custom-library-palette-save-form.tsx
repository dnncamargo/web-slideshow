"use client";

import type { PresentationPalette } from "@powershow/document-schema";
import { useEffect, useRef, useState } from "react";

import { getDefaultCustomLibraryPaletteRepository } from "../persistence/custom-library-palette-repository-instance";
import { useStudioI18n } from "../i18n/studio-i18n-context";
import { createCustomLibraryPaletteDraft } from "./custom-library-palette";
import type { CustomLibraryPaletteRepository } from "./custom-library-palette-repository";
import styles from "../editor/editor-workspace.module.css";

interface CustomLibraryPaletteSaveFormProps {
  palette: PresentationPalette;
  repository?: CustomLibraryPaletteRepository;
  onSaved: () => void;
  onCancel: () => void;
}

export function CustomLibraryPaletteSaveForm({
  palette,
  repository = getDefaultCustomLibraryPaletteRepository(),
  onSaved,
  onCancel,
}: CustomLibraryPaletteSaveFormProps) {
  const { t } = useStudioI18n();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<"failed" | null>(null);
  const activeRef = useRef(true);
  const savingRef = useRef(false);

  useEffect(() => () => { activeRef.current = false; }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || name.trim().length === 0) return;

    savingRef.current = true;
    setIsSaving(true);
    setFeedback(null);

    try {
      const draft = createCustomLibraryPaletteDraft({ name, description, palette });
      await repository.savePalette(draft);
      if (activeRef.current) onSaved();
    } catch {
      if (activeRef.current) setFeedback("failed");
    } finally {
      savingRef.current = false;
      if (activeRef.current) setIsSaving(false);
    }
  }

  return (
    <form className={styles.customLibrarySaveForm} onSubmit={handleSubmit}>
      <label className={styles.customLibrarySaveField}>
        <span>{t("customLibrary.palette.name")}</span>
        <input value={name} onChange={(event) => setName(event.target.value)} disabled={isSaving} autoFocus />
      </label>
      <label className={styles.customLibrarySaveField}>
        <span>{t("customLibrary.palette.descriptionOptional")}</span>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} disabled={isSaving} rows={2} />
      </label>
      {feedback === "failed" ? (
        <p className={`${styles.customLibrarySaveStatus} ${styles.customLibrarySaveError}`} role="alert">
          {t("customLibrary.palette.saveFailed")}
        </p>
      ) : null}
      <div className={styles.customLibrarySaveActions}>
        <button type="button" disabled={isSaving} onClick={onCancel}>{t("customLibrary.cancel")}</button>
        <button type="submit" disabled={isSaving || name.trim().length === 0}>
          {isSaving ? t("customLibrary.palette.saving") : t("customLibrary.palette.save")}
        </button>
      </div>
    </form>
  );
}
