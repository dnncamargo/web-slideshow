"use client";

import type { PowerShowElement } from "@powershow/document-schema";
import { useEffect, useRef, useState } from "react";

import { getDefaultCustomLibraryRepository } from "@/features/persistence/custom-library-repository-instance";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import { createCustomLibraryItemDraft } from "./custom-library-item";
import type { ElementPropertySelectionMap } from "./custom-library-recipe";
import type { CustomLibraryRepository } from "./custom-library-repository";

import styles from "../editor/editor-workspace.module.css";

interface CustomLibrarySaveFormProps {
  root: PowerShowElement;
  selections: ElementPropertySelectionMap;
  repository?: CustomLibraryRepository;
  onSaved: () => void;
  onCancel: () => void;
}

export function CustomLibrarySaveForm({
  root,
  selections,
  repository = getDefaultCustomLibraryRepository(),
  onSaved,
  onCancel,
}: CustomLibrarySaveFormProps) {
  const { t } = useStudioI18n();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const isActiveRef = useRef(true);
  const isSavingRef = useRef(false);

  useEffect(() => () => {
    isActiveRef.current = false;
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSavingRef.current || name.trim().length === 0) return;

    isSavingRef.current = true;
    setIsSaving(true);
    setHasFailed(false);

    try {
      const draft = createCustomLibraryItemDraft({
        name,
        description,
        root,
        selections,
      });
      await repository.saveItem(draft);
      if (isActiveRef.current) {
        onSaved();
      }
    } catch {
      if (isActiveRef.current) {
        setHasFailed(true);
      }
    } finally {
      isSavingRef.current = false;
      if (isActiveRef.current) {
        setIsSaving(false);
      }
    }
  }

  return (
    <form className={styles.customLibrarySaveForm} onSubmit={handleSubmit}>
      <label className={styles.customLibrarySaveField}>
        <span>{t("customLibrary.name")}</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={isSaving}
          autoFocus
        />
      </label>
      <label className={styles.customLibrarySaveField}>
        <span>{t("customLibrary.descriptionOptional")}</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={isSaving}
          rows={2}
        />
      </label>
      {hasFailed && (
        <p
          className={`${styles.customLibrarySaveStatus} ${styles.customLibrarySaveError}`}
          role="alert"
        >
          {t("customLibrary.saveFailed")}
        </p>
      )}
      <div className={styles.customLibrarySaveActions}>
        <button type="button" disabled={isSaving} onClick={onCancel}>
          {t("customLibrary.cancel")}
        </button>
        <button type="submit" disabled={isSaving || name.trim().length === 0}>
          {isSaving ? t("customLibrary.saving") : t("customLibrary.submit")}
        </button>
      </div>
    </form>
  );
}
