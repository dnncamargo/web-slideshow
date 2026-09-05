import type { ElementTypography, FontResource } from "@powershow/document-schema";
import { TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES } from "@powershow/document-schema";
import {
  convertAuthoringLength,
  resolveEffectiveNumericStyleValue,
  type ThemeTypographyDefaults,
} from "@powershow/theme/element-style-defaults";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import {
  getControlName,
  parseOptionalNumber,
} from "../inspector-helpers";

import type { UpdateElementTypography } from "../inspector-types";

import { EffectiveNumberInput } from "./effective-number-input";
import { EffectiveLengthInput } from "./effective-length-input";

export type CoreTypographyProperty = (typeof TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES)[number];

interface ElementTypographyControlProps {
  typography?: ElementTypography | undefined;

  effectiveDefaults: Partial<ThemeTypographyDefaults & ElementTypography>;

  onUpdateTypography?: UpdateElementTypography;

  controlPrefix: string;

  fontResources: readonly FontResource[];

  visibleProperties?: readonly CoreTypographyProperty[];
}

function readFontWeightSelection(
  fontWeight: ElementTypography["fontWeight"],
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
): ElementTypography["fontWeight"] {
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
): ElementTypography["fontStyle"] {
  return value === "normal" || value === "italic" ? value : undefined;
}

function parseTextAlignSelection(
  value: string,
): ElementTypography["textAlign"] {
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

function parseTextTransformSelection(
  value: string,
): ElementTypography["textTransform"] {
  switch (value) {
    case "none":
    case "uppercase":
    case "lowercase":
    case "capitalize":
      return value;

    default:
      return undefined;
  }
}

function parseWhiteSpaceSelection(
  value: string,
): ElementTypography["whiteSpace"] {
  switch (value) {
    case "normal":
    case "nowrap":
    case "pre-line":
    case "pre-wrap":
      return value;

    default:
      return undefined;
  }
}

function parseTextWrapStyleSelection(
  value: string,
): ElementTypography["textWrapStyle"] {
  switch (value) {
    case "auto":
    case "balance":
    case "pretty":
      return value;

    default:
      return undefined;
  }
}

function parseOverflowWrapSelection(
  value: string,
): ElementTypography["overflowWrap"] {
  switch (value) {
    case "normal":
    case "break-word":
    case "anywhere":
      return value;

    default:
      return undefined;
  }
}

function parseTextDecorationLineSelection(
  value: string,
): ElementTypography["textDecorationLine"] {
  switch (value) {
    case "none":
    case "underline":
    case "overline":
    case "line-through":
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

export function ElementTypographyFields({
  typography,
  effectiveDefaults,
  onUpdateTypography,
  controlPrefix,
  fontResources,
  visibleProperties,
}: ElementTypographyControlProps) {
  const { t } = useStudioI18n();

  const currentTypography = typography;
  const isVisible = (property: CoreTypographyProperty): boolean =>
    visibleProperties === undefined || visibleProperties.includes(property);

  function onUpdateStyle(
    update: (current: ElementTypography | undefined) => ElementTypography,
  ): void {
    onUpdateTypography?.(update);
  }

  const fontWeightSelection = readFontWeightSelection(
    currentTypography?.fontWeight ?? effectiveDefaults.fontWeight,
  );

  const showUncuratedFontWeight =
    (currentTypography?.fontWeight ?? effectiveDefaults.fontWeight) !== undefined &&
    !isCuratedFontWeight(currentTypography?.fontWeight ?? effectiveDefaults.fontWeight ?? 400);
  const currentFontFamily = currentTypography?.fontFamily ?? effectiveDefaults.fontFamily ?? "";
  const showUnregisteredFontFamily =
    currentFontFamily !== "" &&
    !fontResources.some(
      (fontResource) => fontResource.family === currentFontFamily,
    );
  const effectiveFontSizePx =
    currentTypography?.fontSize === undefined
      ? effectiveDefaults.fontSize
      : convertAuthoringLength(currentTypography.fontSize, "px");
  const lineHeightValue = effectiveDefaults.lineHeight === undefined && currentTypography?.lineHeight === undefined
    ? { value: "" as const, inherited: true }
    : resolveEffectiveNumericStyleValue(
      currentTypography?.lineHeight,
      effectiveDefaults.lineHeight ?? 0,
    );

  return (
    <>
      {isVisible("fontFamily") ? <div>
        <label className={styles.field}>
          <span>{t("inspector.fontFamily")}</span>

          <select
            id={`${controlPrefix}-font-family`}
            name={getControlName(controlPrefix, "FontFamily")}
            value={currentFontFamily}
            onChange={(event) => {
              const fontFamily = event.target.value || undefined;

              onUpdateStyle((currentTypography) => ({
                ...currentTypography,

                fontFamily,
              }));
            }}
          >
            <option value="">{t("inspector.default")}</option>

            {showUnregisteredFontFamily && (
              <option value={currentFontFamily}>{currentFontFamily}</option>
            )}

            {fontResources.map((fontResource) => (
              <option key={fontResource.id} value={fontResource.family}>
                {fontResource.family}
              </option>
            ))}
          </select>
        </label>

      </div> : null}

      <div className={styles.fieldGrid}>
        {isVisible("fontSize") ? <div className={styles.field}>
          <label htmlFor={`${controlPrefix}-font-size`}>
            {t("inspector.fontSize")}
          </label>

          <EffectiveLengthInput
            id={`${controlPrefix}-font-size`}
            name={getControlName(controlPrefix, "FontSize")}
            min="1"
            value={currentTypography?.fontSize}
            inheritedValue={effectiveDefaults.fontSize}
            preferredUnit="rem"
            units={["px", "rem"]}
            stepByUnit={{ px: "1", rem: "0.1" }}
            onChange={(fontSize) => {

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
        </div> : null}

        {isVisible("fontWeight") ? <label className={styles.field}>
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
        </label> : null}

        {isVisible("fontStyle") ? <label className={styles.field}>
          <span>{t("inspector.fontStyle")}</span>

          <select
            id={`${controlPrefix}-font-style`}
            name={getControlName(controlPrefix, "FontStyle")}
            value={currentTypography?.fontStyle ?? effectiveDefaults.fontStyle ?? ""}
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
        </label> : null}

        {isVisible("textAlign") ? <label className={styles.field}>
          <span>{t("inspector.textAlignment")}</span>

          <select
            id={`${controlPrefix}-text-align`}
            name={getControlName(controlPrefix, "TextAlign")}
            value={currentTypography?.textAlign ?? effectiveDefaults.textAlign ?? ""}
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
        </label> : null}

        {isVisible("lineHeight") ? <div className={styles.field}>
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
        </div> : null}

        {isVisible("letterSpacing") ? <div className={styles.field}>
          <label
            htmlFor={`${controlPrefix}-letter-spacing`}
            title={t("inspector.letterSpacingHelp")}
          >
            {t("inspector.letterSpacing")}
          </label>

          <EffectiveLengthInput
            id={`${controlPrefix}-letter-spacing`}
            name={getControlName(controlPrefix, "LetterSpacing")}
            value={currentTypography?.letterSpacing}
            inheritedValue={effectiveDefaults.letterSpacing}
            preferredUnit="em"
            units={["px", "em", "rem"]}
            relativeFontSizePx={effectiveFontSizePx}
            stepByUnit={{ px: "0.1", em: "0.01", rem: "0.01" }}
            onChange={(letterSpacing) => {

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
        </div> : null}

        {isVisible("textTransform") ? <label className={styles.field}>
          <span>{t("inspector.textCase")}</span>

          <select
            id={`${controlPrefix}-text-transform`}
            name={getControlName(controlPrefix, "TextTransform")}
            value={currentTypography?.textTransform ?? effectiveDefaults.textTransform ?? "none"}
            onChange={(event) => {
              const textTransform = parseTextTransformSelection(
                event.target.value,
              );

              onUpdateStyle((currentStyle) => ({
                ...currentStyle,

                textTransform,
              }));
            }}
          >
            <option value="none">{t("inspector.textCase.none")}</option>

            <option value="uppercase">
              {t("inspector.textCase.uppercase")}
            </option>

            <option value="lowercase">
              {t("inspector.textCase.lowercase")}
            </option>

            <option value="capitalize">
              {t("inspector.textCase.capitalize")}
            </option>
          </select>
        </label> : null}

        {isVisible("whiteSpace") ? <label className={styles.field}>
          <span>{t("inspector.whiteSpace")}</span>

          <select
            id={`${controlPrefix}-white-space`}
            name={getControlName(controlPrefix, "WhiteSpace")}
            value={currentTypography?.whiteSpace ?? effectiveDefaults.whiteSpace ?? "normal"}
            onChange={(event) => {
              const whiteSpace = parseWhiteSpaceSelection(event.target.value);

              onUpdateStyle((currentStyle) => ({
                ...currentStyle,

                whiteSpace,
              }));
            }}
          >
            <option value="normal">{t("inspector.whiteSpace.normal")}</option>

            <option value="nowrap">{t("inspector.whiteSpace.nowrap")}</option>

            <option value="pre-line">
              {t("inspector.whiteSpace.preLine")}
            </option>

            <option value="pre-wrap">
              {t("inspector.whiteSpace.preWrap")}
            </option>
          </select>
        </label> : null}

        {isVisible("textWrapStyle") ? <label className={styles.field}>
          <span>{t("inspector.textWrap")}</span>

          <select
            id={`${controlPrefix}-text-wrap-style`}
            name={getControlName(controlPrefix, "TextWrapStyle")}
            value={currentTypography?.textWrapStyle ?? effectiveDefaults.textWrapStyle ?? "auto"}
            onChange={(event) => {
              const textWrapStyle = parseTextWrapStyleSelection(
                event.target.value,
              );

              onUpdateStyle((currentStyle) => ({
                ...currentStyle,

                textWrapStyle,
              }));
            }}
          >
            <option value="auto">{t("inspector.textWrap.wrap")}</option>

            <option value="balance">{t("inspector.textWrap.balance")}</option>

            <option value="pretty">{t("inspector.textWrap.pretty")}</option>
          </select>
        </label> : null}

        {isVisible("overflowWrap") ? <label className={styles.field}>
          <span>{t("inspector.overflowWrap")}</span>

          <select
            id={`${controlPrefix}-overflow-wrap`}
            name={getControlName(controlPrefix, "OverflowWrap")}
            value={currentTypography?.overflowWrap ?? effectiveDefaults.overflowWrap ?? "normal"}
            onChange={(event) => {
              const overflowWrap = parseOverflowWrapSelection(
                event.target.value,
              );

              onUpdateStyle((currentStyle) => ({
                ...currentStyle,

                overflowWrap,
              }));
            }}
          >
            <option value="normal">
              {t("inspector.overflowWrap.normal")}
            </option>

            <option value="break-word">
              {t("inspector.overflowWrap.breakWord")}
            </option>

            <option value="anywhere">
              {t("inspector.overflowWrap.anywhere")}
            </option>
          </select>
        </label> : null}

        {isVisible("textDecorationLine") ? <label className={styles.field}>
          <span>{t("inspector.textDecorationLine")}</span>

          <select
            id={`${controlPrefix}-text-decoration-line`}
            name={getControlName(controlPrefix, "TextDecorationLine")}
            value={currentTypography?.textDecorationLine ?? effectiveDefaults.textDecorationLine ?? "none"}
            onChange={(event) => {
              const textDecorationLine = parseTextDecorationLineSelection(
                event.target.value,
              );

              onUpdateStyle((currentStyle) => ({
                ...currentStyle,

                textDecorationLine,
              }));
            }}
          >
            <option value="none">
              {t("inspector.textDecorationLine.none")}
            </option>

            <option value="underline">
              {t("inspector.textDecorationLine.underline")}
            </option>

            <option value="overline">
              {t("inspector.textDecorationLine.overline")}
            </option>

            <option value="line-through">
              {t("inspector.textDecorationLine.lineThrough")}
            </option>
          </select>
        </label> : null}
      </div>
    </>
  );
}

export function ElementTypographyControl(props: ElementTypographyControlProps) {
  const { t } = useStudioI18n();

  return (
    <div className={styles.appearanceSubgroup}>
      <span className={styles.appearanceSubheading}>
        {t("inspector.typography")}
      </span>

      <ElementTypographyFields {...props} />
    </div>
  );
}

// ============================================================
// END: ELEMENT TYPOGRAPHY CONTROL
// ============================================================
