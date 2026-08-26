"use client";

import {
  colorToPickerHex,
  normalizeColor,
  type Color,
  type PresentationPaletteColor,
} from "@powershow/document-schema";
import { useEffect, useState } from "react";

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
        <PaletteManagerRow key={color.id} color={color} onRename={onRename} onUpdate={onUpdate} onRemove={onRemove} removeLabel={t("inspector.removeColor")} />
      ))}
    </section>
  );
}

function PaletteManagerRow({
  color,
  onRename,
  onUpdate,
  onRemove,
  removeLabel,
}: {
  color: PresentationPaletteColor;
  onRename: (id: string, name: string) => void;
  onUpdate: (id: string, color: Color) => void;
  onRemove: (id: string) => void;
  removeLabel: string;
}) {
  const [name, setName] = useState(color.name);

  useEffect(() => setName(color.name), [color.name]);

  function commitName() {
    const nextName = name.trim();
    if (nextName.length > 0 && nextName !== color.name) onRename(color.id, nextName);
    if (nextName.length === 0) setName(color.name);
  }

  return (
    <div className={styles.colorPaletteManagerRow}>
      <input aria-label={`${color.name} name`} value={name} onChange={(event) => setName(event.target.value)} onBlur={commitName} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitName(); } }} />
      <input aria-label={`${color.name} value`} type="color" value={colorToPickerHex(color.value) ?? "#ffffff"} onChange={(event) => onUpdate(color.id, event.target.value)} />
      <button type="button" onClick={() => onRemove(color.id)}>{removeLabel}</button>
    </div>
  );
}
