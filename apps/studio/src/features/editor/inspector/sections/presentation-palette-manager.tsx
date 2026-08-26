"use client";

import {
  colorToPickerHex,
  normalizeColor,
  type Color,
  type PresentationPaletteColor,
  type PresentationPalette,
} from "@powershow/document-schema";
import { useEffect, useState } from "react";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import type { CustomLibraryPaletteDraft } from "@/features/custom-library/custom-library-palette";
import type { CustomLibraryPaletteRepository } from "@/features/custom-library/custom-library-palette-repository";
import {
  CustomLibraryPaletteAddPicker,
  type CustomLibraryPaletteAddOutcome,
} from "@/features/custom-library/custom-library-palette-add-picker";
import { CustomLibraryPaletteSaveForm } from "@/features/custom-library/custom-library-palette-save-form";
import styles from "../../editor-workspace.module.css";

interface PresentationPaletteManagerProps {
  colors: readonly PresentationPaletteColor[];
  palette?: PresentationPalette;
  customLibraryPaletteRepository?: CustomLibraryPaletteRepository;
  onAddLibraryPalette?: (palette: CustomLibraryPaletteDraft) => CustomLibraryPaletteAddOutcome;
  onAdd: (name: string, color: Color) => void;
  onRename: (id: string, name: string) => void;
  onUpdate: (id: string, color: Color) => void;
  onRemove: (id: string) => void;
}

export function PresentationPaletteManager({
  colors,
  palette,
  customLibraryPaletteRepository,
  onAddLibraryPalette,
  onAdd,
  onRename,
  onUpdate,
  onRemove,
}: PresentationPaletteManagerProps) {
  const { t } = useStudioI18n();
  const [name, setName] = useState("");
  const [value, setValue] = useState<Color>("#ffffff");
  const [activeLibraryPanel, setActiveLibraryPanel] = useState<"save" | "add" | null>(null);
  const [saveFeedback, setSaveFeedback] = useState(false);

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
      <div className={styles.customLibraryPaletteActionRow}>
        <button
          type="button"
          disabled={!palette || palette.colors.length === 0}
          onClick={() => { setActiveLibraryPanel("save"); setSaveFeedback(false); }}
        >
          {t("customLibrary.palette.saveToLibrary")}
        </button>
        <button type="button" onClick={() => setActiveLibraryPanel("add")}>
          {t("customLibrary.palette.addFromLibrary")}
        </button>
      </div>
      {saveFeedback ? <p className={styles.customLibrarySaveStatus} role="status">{t("customLibrary.palette.saved")}</p> : null}
      {activeLibraryPanel === "save" && palette ? (
        <CustomLibraryPaletteSaveForm
          palette={palette}
          repository={customLibraryPaletteRepository}
          onSaved={() => { setActiveLibraryPanel(null); setSaveFeedback(true); }}
          onCancel={() => setActiveLibraryPanel(null)}
        />
      ) : null}
      {activeLibraryPanel === "add" ? (
        <CustomLibraryPaletteAddPicker
          isOpen
          repository={customLibraryPaletteRepository}
          onAdd={onAddLibraryPalette ?? (() => ({ ok: false, reason: "unavailable" }))}
        />
      ) : null}
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
