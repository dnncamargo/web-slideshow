"use client";

import {
  normalizeColor,
  type Color,
  type PresentationPaletteColor,
} from "@powershow/document-schema";
import { useState } from "react";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import styles from "../../editor-workspace.module.css";

interface PresentationPaletteManagerProps {
  colors: readonly PresentationPaletteColor[];
  onAdd: (name: string, color: Color) => void;
  onRename: (id: string, name: string) => void;
  onUpdate: (id: string, color: Color) => void;
  onRemove: (id: string) => void;
}

export function PresentationPaletteManager({ colors, onAdd, onRename, onUpdate, onRemove }: PresentationPaletteManagerProps) {
  const { t } = useStudioI18n();
  const [name, setName] = useState("");
  const [value, setValue] = useState<Color>("#ffffff");

  function add() {
    const trimmedName = name.trim();
    const normalized = normalizeColor(value);
    if (!trimmedName || !normalized) return;
    onAdd(trimmedName, normalized);
    setName("");
  }

  return (
    <section className={styles.inspectorGroup} aria-label={t("inspector.presentationPalette")}>
      <span className={styles.inspectorLabel}>{t("inspector.presentationPalette")}</span>
      <div className={styles.colorPaletteManagerAdd}>
        <input aria-label={t("inspector.paletteColorName")} placeholder={t("inspector.paletteColorName")} value={name} onChange={(event) => setName(event.target.value)} />
        <input aria-label={t("inspector.paletteColorValue")} type="color" value={value} onChange={(event) => setValue(event.target.value)} />
        <button type="button" disabled={!name.trim()} onClick={add}>{t("inspector.addPaletteColor")}</button>
      </div>
      {colors.map((color) => (
        <div className={styles.colorPaletteManagerRow} key={color.id}>
          <input aria-label={`${color.name} name`} value={color.name} onChange={(event) => onRename(color.id, event.target.value)} />
          <input aria-label={`${color.name} value`} type="color" value={color.value.length === 7 ? color.value : "#ffffff"} onChange={(event) => onUpdate(color.id, event.target.value)} />
          <button type="button" onClick={() => onRemove(color.id)}>{t("inspector.removeColor")}</button>
        </div>
      ))}
    </section>
  );
}
