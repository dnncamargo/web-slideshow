import { useEffect, useRef, useState } from "react";

import type {
  BackgroundPattern,
  ContainerElement,
} from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import { getControlName } from "../inspector-helpers";

import {
  BACKGROUND_PATTERN_PRESETS,
  findBackgroundPatternPreset,
  parseBackgroundPatternCss,
} from "./element-background-pattern";

interface ContainerBackgroundPatternControlProps {
  element: ContainerElement;
  onChange: (pattern: BackgroundPattern | undefined, color?: string) => void;
  controlPrefix: string;
}

type PatternControlMode =
  | "none"
  | "custom"
  | (typeof BACKGROUND_PATTERN_PRESETS)[number]["id"];

function patternSignature(pattern: BackgroundPattern | undefined): string {
  return pattern === undefined ? "none" : JSON.stringify(pattern);
}

function renderPatternCss(
  pattern: BackgroundPattern | undefined,
  color: string | undefined,
): string {
  if (pattern === undefined) return "";

  const declarations = [
    ...(color === undefined ? [] : [`background-color: ${color};`]),
    `background-image: ${pattern.image};`,
    ...(pattern.size === undefined ? [] : [`background-size: ${pattern.size};`]),
    ...(pattern.position === undefined
      ? []
      : [`background-position: ${pattern.position};`]),
    ...(pattern.repeat === undefined ? [] : [`background-repeat: ${pattern.repeat};`]),
    ...(pattern.opacity === undefined ? [] : [`opacity: ${pattern.opacity};`]),
  ];

  return declarations.join("\n");
}

export function ContainerBackgroundPatternControl({
  element,
  onChange,
  controlPrefix,
}: ContainerBackgroundPatternControlProps) {
  const { t } = useStudioI18n();
  const pattern = element.style?.background?.pattern;
  const color = typeof element.style?.background?.color === "string"
    ? element.style.background.color
    : undefined;
  const presetId = pattern === undefined ? undefined : findBackgroundPatternPreset(pattern);
  const derivedMode: PatternControlMode = pattern === undefined ? "none" : presetId ?? "custom";
  const patternKey = patternSignature(pattern);
  const styleRef = useRef(element.style);
  const [mode, setMode] = useState<PatternControlMode>(derivedMode);
  const [customCss, setCustomCss] = useState(() => renderPatternCss(pattern, color));
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    styleRef.current = element.style;
  }, [element.style]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const currentBackground = styleRef.current?.background;
      setMode(derivedMode);
      setCustomCss(renderPatternCss(
        currentBackground?.pattern,
        typeof currentBackground?.color === "string" ? currentBackground.color : undefined,
      ));
      setError(undefined);
    });
    return () => {
      active = false;
    };
  }, [derivedMode, patternKey]);

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
            ) return;

            setMode(nextMode as PatternControlMode);
            if (nextMode === "none") {
              setError(undefined);
              onChange(undefined);
              return;
            }

            const preset = BACKGROUND_PATTERN_PRESETS.find((candidate) => candidate.id === nextMode);
            if (preset === undefined) {
              if (nextMode === "custom") {
                setCustomCss(renderPatternCss(pattern, color));
                setError(undefined);
              }
              return;
            }

            setError(undefined);
            onChange(preset.pattern);
          }}
        >
          <option value="none">{t("inspector.pattern.none")}</option>
          <option value="grid">{t("inspector.pattern.grid")}</option>
          <option value="fine-grid">{t("inspector.pattern.fineGrid")}</option>
          <option value="dots">{t("inspector.pattern.dots")}</option>
          <option value="offset-dots">{t("inspector.pattern.offsetDots")}</option>
          <option value="diagonal-lines">{t("inspector.pattern.diagonalLines")}</option>
          <option value="custom">{t("inspector.pattern.custom")}</option>
        </select>
      </label>

      {mode === "custom" && (
        <div className={styles.field}>
          <label htmlFor={`${controlPrefix}-custom-pattern-css`}>{t("inspector.pattern.customCss")}</label>
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
              onChange(parsed.backgroundPattern, parsed.background);
            }}
          >
            {t("inspector.pattern.apply")}
          </button>
        </div>
      )}
    </div>
  );
}
