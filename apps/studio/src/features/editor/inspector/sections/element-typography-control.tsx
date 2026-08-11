import type { ElementStyle } from "@powershow/document-schema";
import { useState } from "react";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import {
  getControlName,
  parseOptionalNumber,
  readAbsoluteNumber,
} from "../inspector-helpers";

import type {
  FontResourceControls,
  UpdateElementStyle,
} from "../inspector-types";

import { PresentationFontManager } from "./presentation-font-manager";

interface ElementTypographyControlProps {
  style: ElementStyle | undefined;

  onUpdateStyle: UpdateElementStyle;

  controlPrefix: string;

  fontResourceControls: FontResourceControls;
}

function readFontWeightSelection(
  fontWeight: ElementStyle["fontWeight"],
): string {
  return fontWeight === undefined ? "" : String(fontWeight);
}

function isCuratedFontWeight(fontWeight: number): boolean {
  return (
    fontWeight === 300 ||
    fontWeight === 400 ||
    fontWeight === 500 ||
    fontWeight === 600 ||
    fontWeight === 700
  );
}

function parseFontWeightSelection(
  value: string,
): ElementStyle["fontWeight"] {
  const fontWeight = parseOptionalNumber(value);

  return fontWeight !== undefined &&
    Number.isInteger(fontWeight) &&
    fontWeight >= 100 &&
    fontWeight <= 900 &&
    fontWeight % 100 === 0
    ? fontWeight
    : undefined;
}

function parseFontStyleSelection(
  value: string,
): ElementStyle["fontStyle"] {
  return value === "normal" || value === "italic" ? value : undefined;
}

function parseTextAlignSelection(
  value: string,
): ElementStyle["textAlign"] {
  switch (value) {
    case "left":
    case "center":
    case "right":
    case "justify":
      return value;

    default:
      return undefined;
  }
}

function parseOptionalPositiveNumber(value: string): number | undefined {
  const number = parseOptionalNumber(value);

  return number !== undefined && number > 0 ? number : undefined;
}

// ============================================================
// BEGIN: ELEMENT TYPOGRAPHY CONTROL
// ============================================================

export function ElementTypographyControl({
  style,
  onUpdateStyle,
  controlPrefix,
  fontResourceControls,
}: ElementTypographyControlProps) {
  const { t } = useStudioI18n();
  const [isFontManagerOpen, setIsFontManagerOpen] = useState(false);

  const fontWeightSelection = readFontWeightSelection(style?.fontWeight);

  const showUncuratedFontWeight =
    style?.fontWeight !== undefined &&
    !isCuratedFontWeight(style.fontWeight);
  const currentFontFamily = style?.fontFamily ?? "";
  const showUnregisteredFontFamily =
    currentFontFamily !== "" &&
    !fontResourceControls.fontResources.some(
      (fontResource) => fontResource.family === currentFontFamily,
    );
  const fontManagerId = `${controlPrefix}-presentation-font-manager`;

  return (
    <div className={styles.appearanceSubgroup}>
      <span className={styles.appearanceSubheading}>
        {t("inspector.typography")}
      </span>

      <div className={styles.fontFamilyRow}>
        <label className={styles.field}>
          <span>{t("inspector.fontFamily")}</span>

          <select
            id={`${controlPrefix}-font-family`}
            name={getControlName(controlPrefix, "FontFamily")}
            value={currentFontFamily}
            onChange={(event) => {
              const fontFamily = event.target.value || undefined;

              onUpdateStyle((currentStyle) => ({
                ...currentStyle,

                fontFamily,
              }));
            }}
          >
            <option value="">{t("inspector.default")}</option>

            {showUnregisteredFontFamily && (
              <option value={currentFontFamily}>{currentFontFamily}</option>
            )}

            {fontResourceControls.fontResources.map((fontResource) => (
              <option key={fontResource.id} value={fontResource.family}>
                {fontResource.family}
              </option>
            ))}
          </select>
        </label>

        <button
          className={styles.secondaryButton}
          type="button"
          aria-expanded={isFontManagerOpen}
          aria-controls={fontManagerId}
          onClick={() => {
            setIsFontManagerOpen((isOpen) => !isOpen);
          }}
        >
          {t("inspector.manageFonts")}
        </button>
      </div>

      {isFontManagerOpen && (
        <PresentationFontManager
          id={fontManagerId}
          {...fontResourceControls}
        />
      )}

      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span>{t("inspector.fontSize")}</span>

          <div className={styles.unitInput}>
            <input
              id={`${controlPrefix}-font-size`}
              name={getControlName(controlPrefix, "FontSize")}
              type="number"
              min="1"
              value={readAbsoluteNumber(style?.fontSize)}
              onChange={(event) => {
                const fontSize = parseOptionalPositiveNumber(
                  event.target.value,
                );

                onUpdateStyle((currentStyle) => ({
                  ...currentStyle,

                  fontSize,
                }));
              }}
            />

            <span>px</span>
          </div>
        </label>

        <label className={styles.field}>
          <span>{t("inspector.fontWeight")}</span>

          <select
            id={`${controlPrefix}-font-weight`}
            name={getControlName(controlPrefix, "FontWeight")}
            value={fontWeightSelection}
            onChange={(event) => {
              const fontWeight = parseFontWeightSelection(event.target.value);

              onUpdateStyle((currentStyle) => ({
                ...currentStyle,

                fontWeight,
              }));
            }}
          >
            <option value="">{t("inspector.default")}</option>

            {showUncuratedFontWeight && (
              <option value={fontWeightSelection}>{fontWeightSelection}</option>
            )}

            <option value="300">{t("inspector.fontWeight.light")}</option>

            <option value="400">{t("inspector.fontWeight.normal")}</option>

            <option value="500">{t("inspector.fontWeight.medium")}</option>

            <option value="600">
              {t("inspector.fontWeight.semibold")}
            </option>

            <option value="700">{t("inspector.fontWeight.bold")}</option>
          </select>
        </label>

        <label className={styles.field}>
          <span>{t("inspector.fontStyle")}</span>

          <select
            id={`${controlPrefix}-font-style`}
            name={getControlName(controlPrefix, "FontStyle")}
            value={style?.fontStyle ?? ""}
            onChange={(event) => {
              const fontStyle = parseFontStyleSelection(event.target.value);

              onUpdateStyle((currentStyle) => ({
                ...currentStyle,

                fontStyle,
              }));
            }}
          >
            <option value="">{t("inspector.default")}</option>

            <option value="normal">{t("inspector.fontStyle.normal")}</option>

            <option value="italic">{t("inspector.fontStyle.italic")}</option>
          </select>
        </label>

        <label className={styles.field}>
          <span>{t("inspector.textAlignment")}</span>

          <select
            id={`${controlPrefix}-text-align`}
            name={getControlName(controlPrefix, "TextAlign")}
            value={style?.textAlign ?? ""}
            onChange={(event) => {
              const textAlign = parseTextAlignSelection(event.target.value);

              onUpdateStyle((currentStyle) => ({
                ...currentStyle,

                textAlign,
              }));
            }}
          >
            <option value="">{t("inspector.default")}</option>

            <option value="left">{t("inspector.textAlign.left")}</option>

            <option value="center">{t("inspector.textAlign.center")}</option>

            <option value="right">{t("inspector.textAlign.right")}</option>

            <option value="justify">{t("inspector.textAlign.justify")}</option>
          </select>
        </label>

        <label className={styles.field}>
          <span title={t("inspector.lineHeightHelp")}>
            {t("inspector.lineHeight")}
          </span>

          <div className={styles.unitInput}>
            <input
              id={`${controlPrefix}-line-height`}
              name={getControlName(controlPrefix, "LineHeight")}
              type="number"
              step="0.1"
              value={style?.lineHeight ?? ""}
              onChange={(event) => {
                const lineHeight = parseOptionalPositiveNumber(
                  event.target.value,
                );

                onUpdateStyle((currentStyle) => ({
                  ...currentStyle,

                  lineHeight,
                }));
              }}
            />

            <span>×</span>
          </div>
        </label>

        <label className={styles.field}>
          <span title={t("inspector.letterSpacingHelp")}>
            {t("inspector.letterSpacing")}
          </span>

          <div className={styles.unitInput}>
            <input
              id={`${controlPrefix}-letter-spacing`}
              name={getControlName(controlPrefix, "LetterSpacing")}
              type="number"
              step="0.1"
              value={readAbsoluteNumber(style?.letterSpacing)}
              onChange={(event) => {
                const letterSpacing = parseOptionalNumber(event.target.value);

                onUpdateStyle((currentStyle) => ({
                  ...currentStyle,

                  letterSpacing,
                }));
              }}
            />

            <span>px</span>
          </div>
        </label>
      </div>
    </div>
  );
}

// ============================================================
// END: ELEMENT TYPOGRAPHY CONTROL
// ============================================================
