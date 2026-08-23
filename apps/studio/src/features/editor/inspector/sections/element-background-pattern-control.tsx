import { useEffect, useRef, useState } from "react";

import type { BackgroundPattern, ElementStyle } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import { getControlName } from "../inspector-helpers";
import type { UpdateElementStyle } from "../inspector-types";

import {
  BACKGROUND_PATTERN_PRESETS,
  findBackgroundPatternPreset,
  parseBackgroundPatternCss,
  renderBackgroundPatternCss,
} from "./element-background-pattern";

interface ElementBackgroundPatternControlProps {
  elementId: string;
  style: ElementStyle | undefined;
  onUpdateStyle: UpdateElementStyle;
  controlPrefix: string;
}

type PatternControlMode =
  | "none"
  | "custom"
  | (typeof BACKGROUND_PATTERN_PRESETS)[number]["id"];

function patternSignature(pattern: BackgroundPattern | undefined): string {
  return pattern === undefined ? "none" : JSON.stringify(pattern);
}

export function ElementBackgroundPatternControl({
  elementId,
  style,
  onUpdateStyle,
  controlPrefix,
}: ElementBackgroundPatternControlProps) {
  const { t } = useStudioI18n();
  const pattern = style?.backgroundPattern;
  const presetId = pattern === undefined ? undefined : findBackgroundPatternPreset(pattern);
  const derivedMode: PatternControlMode = pattern === undefined ? "none" : presetId ?? "custom";
  const patternKey = patternSignature(pattern);
  const styleRef = useRef(style);
  const [mode, setMode] = useState<PatternControlMode>(derivedMode);
  const [customCss, setCustomCss] = useState(() => renderBackgroundPatternCss(style));
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    styleRef.current = style;
  }, [style]);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      setMode(derivedMode);
      setCustomCss(renderBackgroundPatternCss(styleRef.current));
      setError(undefined);
    });

    return () => {
      active = false;
    };
  }, [elementId, derivedMode, patternKey]);

  return (
    <div className={styles.gradientControl}>
      <label className={styles.field}>
        <span title={t("inspector.patternHelp")}>{t("inspector.pattern")}</span>

        <select
          id={`${controlPrefix}-background-pattern`}
          name={getControlName(controlPrefix, "BackgroundPattern")}
          value={mode}
          onChange={(event) => {
            const nextMode = event.target.value;

            if (
              nextMode !== "none" &&
              nextMode !== "custom" &&
              !BACKGROUND_PATTERN_PRESETS.some((preset) => preset.id === nextMode)
            ) {
              return;
            }

            setMode(nextMode as PatternControlMode);

            if (nextMode === "none") {
              setError(undefined);
              onUpdateStyle((currentStyle) => ({
                ...currentStyle,
                backgroundPattern: undefined,
              }));
              return;
            }

            const preset = BACKGROUND_PATTERN_PRESETS.find(
              (candidate) => candidate.id === nextMode,
            );

            if (!preset) {
              if (nextMode === "custom") {
                setCustomCss(renderBackgroundPatternCss(style));
                setError(undefined);
              }
              return;
            }

            setError(undefined);
            onUpdateStyle((currentStyle) => ({
              ...currentStyle,
              backgroundPattern: preset.pattern,
              backgroundGradient: undefined,
            }));
          }}
        >
          <option value="none">{t("inspector.pattern.none")}</option>
          <option value="grid">{t("inspector.pattern.grid")}</option>
          <option value="fine-grid">{t("inspector.pattern.fineGrid")}</option>
          <option value="dots">{t("inspector.pattern.dots")}</option>
          <option value="offset-dots">{t("inspector.pattern.offsetDots")}</option>
          <option value="diagonal-lines">
            {t("inspector.pattern.diagonalLines")}
          </option>
          <option value="custom">{t("inspector.pattern.custom")}</option>
        </select>
      </label>

      {mode === "custom" && (
        <div className={styles.field}>
          <label htmlFor={`${controlPrefix}-custom-pattern-css`}>
            {t("inspector.pattern.customCss")}
          </label>
          <textarea
            id={`${controlPrefix}-custom-pattern-css`}
            name={getControlName(controlPrefix, "CustomPatternCss")}
            value={customCss}
            onChange={(event) => {
              setCustomCss(event.target.value);
              setError(undefined);
            }}
            rows={6}
          />
          {error && <span role="alert">{error}</span>}
          <button
            id={`${controlPrefix}-apply-background-pattern`}
            className={styles.secondaryButton}
            type="button"
            onClick={() => {
              const parsed = parseBackgroundPatternCss(customCss);

              if (!parsed.success) {
                setError(parsed.error);
                return;
              }

              setError(undefined);
              onUpdateStyle((currentStyle) => ({
                ...currentStyle,
                ...(parsed.background === undefined
                  ? {}
                  : { background: parsed.background }),
                backgroundPattern: parsed.backgroundPattern,
                backgroundGradient: undefined,
              }));
            }}
          >
            {t("inspector.pattern.apply")}
          </button>
        </div>
      )}
    </div>
  );
}
