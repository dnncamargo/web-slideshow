import type { ElementStyle } from "@powershow/document-schema";
import {
  resolveEffectiveNumericStyleValue,
  type ThemeTypographyDefaults,
} from "@powershow/theme/element-style-defaults";
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

import { EffectiveNumberInput } from "./effective-number-input";

interface ElementTypographyControlProps {
  selectedElementId: string;

  style: ElementStyle | undefined;

  effectiveDefaults: ThemeTypographyDefaults;

  onUpdateStyle: UpdateElementStyle;

  controlPrefix: string;

  fontResourceControls: FontResourceControls;
}

interface FontApplySuggestion {
  elementId: string;
  family: string;
  applied: boolean;
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
  selectedElementId,
  style,
  effectiveDefaults,
  onUpdateStyle,
  controlPrefix,
  fontResourceControls,
}: ElementTypographyControlProps) {
  const { t } = useStudioI18n();
  const [isFontManagerOpen, setIsFontManagerOpen] = useState(false);
  const [fontApplySuggestion, setFontApplySuggestion] =
    useState<FontApplySuggestion>();

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
  const activeFontApplySuggestion =
    fontApplySuggestion?.elementId === selectedElementId
      ? fontApplySuggestion
      : undefined;
  const fontSizeValue =
    style?.fontSize === undefined
      ? resolveEffectiveNumericStyleValue(
          undefined,
          effectiveDefaults.fontSize,
        )
      : {
          value: readAbsoluteNumber(style.fontSize),
          inherited: false,
        };
  const lineHeightValue = resolveEffectiveNumericStyleValue(
    style?.lineHeight,
    effectiveDefaults.lineHeight,
  );
  const letterSpacingValue =
    style?.letterSpacing === undefined
      ? resolveEffectiveNumericStyleValue(
          undefined,
          effectiveDefaults.letterSpacing,
        )
      : {
          value: readAbsoluteNumber(style.letterSpacing),
          inherited: false,
        };

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
          onFontAdded={(family) => {
            setFontApplySuggestion({
              elementId: selectedElementId,
              family,
              applied: false,
            });
          }}
          {...fontResourceControls}
        />
      )}

      {activeFontApplySuggestion && (
        <div className={styles.fontApplySuggestion} aria-live="polite">
          <span>
            {t("inspector.fontAddedToPresentation", {
              family: activeFontApplySuggestion.family,
            })}
          </span>

          {activeFontApplySuggestion.applied ? (
            <strong>{t("inspector.appliedToSelectedText")}</strong>
          ) : (
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => {
                if (activeFontApplySuggestion.elementId !== selectedElementId) {
                  return;
                }

                onUpdateStyle((currentStyle) => ({
                  ...currentStyle,
                  fontFamily: activeFontApplySuggestion.family,
                }));
                setFontApplySuggestion({
                  ...activeFontApplySuggestion,
                  applied: true,
                });
              }}
            >
              {t("inspector.applyToSelectedText")}
            </button>
          )}
        </div>
      )}

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label htmlFor={`${controlPrefix}-font-size`}>
            {t("inspector.fontSize")}
          </label>

          <EffectiveNumberInput
            id={`${controlPrefix}-font-size`}
            name={getControlName(controlPrefix, "FontSize")}
            min="1"
            value={fontSizeValue.value}
            inherited={fontSizeValue.inherited}
            unit="px"
            onChange={(value) => {
              const fontSize = parseOptionalPositiveNumber(value);

              onUpdateStyle((currentStyle) => ({
                ...currentStyle,

                fontSize,
              }));
            }}
            onReset={() => {
              onUpdateStyle((currentStyle) => ({
                ...currentStyle,

                fontSize: undefined,
              }));
            }}
          />
        </div>

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

        <div className={styles.field}>
          <label
            htmlFor={`${controlPrefix}-line-height`}
            title={t("inspector.lineHeightHelp")}
          >
            {t("inspector.lineHeight")}
          </label>

          <EffectiveNumberInput
            id={`${controlPrefix}-line-height`}
            name={getControlName(controlPrefix, "LineHeight")}
            step="0.1"
            value={lineHeightValue.value}
            inherited={lineHeightValue.inherited}
            unit="×"
            onChange={(value) => {
              const lineHeight = parseOptionalPositiveNumber(value);

              onUpdateStyle((currentStyle) => ({
                ...currentStyle,

                lineHeight,
              }));
            }}
            onReset={() => {
              onUpdateStyle((currentStyle) => ({
                ...currentStyle,

                lineHeight: undefined,
              }));
            }}
          />
        </div>

        <div className={styles.field}>
          <label
            htmlFor={`${controlPrefix}-letter-spacing`}
            title={t("inspector.letterSpacingHelp")}
          >
            {t("inspector.letterSpacing")}
          </label>

          <EffectiveNumberInput
            id={`${controlPrefix}-letter-spacing`}
            name={getControlName(controlPrefix, "LetterSpacing")}
            step="0.1"
            value={letterSpacingValue.value}
            inherited={letterSpacingValue.inherited}
            unit="px"
            onChange={(value) => {
              const letterSpacing = parseOptionalNumber(value);

              onUpdateStyle((currentStyle) => ({
                ...currentStyle,

                letterSpacing,
              }));
            }}
            onReset={() => {
              onUpdateStyle((currentStyle) => ({
                ...currentStyle,

                letterSpacing: undefined,
              }));
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// END: ELEMENT TYPOGRAPHY CONTROL
// ============================================================
