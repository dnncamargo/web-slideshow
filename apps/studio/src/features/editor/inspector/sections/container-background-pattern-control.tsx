import { useEffect, useRef, useState } from "react";

import type {
  BackgroundPattern,
  ContainerElement,
} from "@web-slideshow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";
import { useAuthoringHistory } from "../../authoring-history-context";

import { getControlName } from "../inspector-helpers";
import { ColorControl } from "./color-control";

import {
  BACKGROUND_PATTERN_PRESETS,
  findBackgroundPatternPreset,
  getPatternSizeValue,
  materializeBackgroundPatternPreset,
  parseBackgroundPatternCss,
  updateBackgroundPatternRotation,
  updateBackgroundPatternSize,
} from "./element-background-pattern";

interface ContainerBackgroundPatternControlProps {
  element: ContainerElement;
  localElement?: ContainerElement;
  onChange: (pattern: BackgroundPattern | undefined, color?: string) => void;
  controlPrefix: string;
  allowNone?: boolean;
}

type PatternControlMode =
  | "none"
  | "custom"
  | (typeof BACKGROUND_PATTERN_PRESETS)[number]["id"];

function patternSignature(pattern: BackgroundPattern | undefined): string {
  return pattern === undefined ? "none" : JSON.stringify(pattern);
}

function samePattern(left: BackgroundPattern | undefined, right: BackgroundPattern | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.image === right.image
    && left.size === right.size
    && left.position === right.position
    && left.repeat === right.repeat
    && left.opacity === right.opacity
    && JSON.stringify(left.colors) === JSON.stringify(right.colors)
    && left.rotation === right.rotation;
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
  localElement = element,
  onChange,
  controlPrefix,
  allowNone = true,
}: ContainerBackgroundPatternControlProps) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const pattern = element.style?.background?.pattern;
  const color = typeof element.style?.background?.color === "string"
    ? element.style.background.color
    : undefined;
  const localPattern = localElement.style?.background?.pattern;
  const localColor = typeof localElement.style?.background?.color === "string"
    ? localElement.style.background.color
    : undefined;
  const presetId = pattern === undefined ? undefined : findBackgroundPatternPreset(pattern);
  const derivedMode: PatternControlMode = pattern === undefined ? "none" : presetId ?? "custom";
  const structuredPattern = presetId === undefined || pattern === undefined
    ? pattern
    : materializeBackgroundPatternPreset(pattern, presetId);
  const patternKey = patternSignature(pattern);
  const styleRef = useRef(element.style);
  const [mode, setMode] = useState<PatternControlMode>(derivedMode);
  const [customCss, setCustomCss] = useState(() => renderPatternCss(pattern, color));
  const [error, setError] = useState<string | undefined>();

  function runDiscrete(callback: () => void): void {
    const meta = { kind: "element.setting", labelKey: "history.element.setting", labelParams: { setting: "container.backgroundPattern" } } as const;
    if (authoringHistory) authoringHistory.discrete(meta, callback);
    else callback();
  }

  function updateContinuous(key: string, callback: () => void): void {
    if (!authoringHistory) {
      callback();
      return;
    }
    authoringHistory.begin(key, { kind: "number.change", labelKey: "history.number.change" });
    authoringHistory.update(key, callback);
  }

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
              if (!allowNone) return;
              setError(undefined);
              if (localPattern === undefined) return;
              runDiscrete(() => onChange(undefined));
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
            if (samePattern(localPattern, preset.pattern)) return;
            runDiscrete(() => onChange(preset.pattern));
          }}
        >
          {allowNone && <option value="none">{t("inspector.pattern.none")}</option>}
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
              const nextLocalColor = parsed.background === undefined ? localColor : parsed.background;
              if (samePattern(localPattern, parsed.backgroundPattern) && localColor === nextLocalColor) return;
              runDiscrete(() => onChange(parsed.backgroundPattern, parsed.background));
            }}
          >
            {t("inspector.pattern.apply")}
          </button>
        </div>
      )}

      {presetId !== undefined && structuredPattern !== undefined && (
        <div className={styles.gradientControl}>
          <span>{t("inspector.pattern.colors")}</span>
          {structuredPattern.colors?.map((color, index) => (
            <div className={styles.colorControl} key={`${controlPrefix}-pattern-color-${index + 1}`}>
              <label className={styles.field}>
                <span>{structuredPattern.colors?.length === 1
                  ? t("inspector.pattern.color")
                  : t("inspector.pattern.colorNumber", { number: index + 1 })}</span>
                <ColorControl
                  id={`${controlPrefix}-pattern-color-${index + 1}`}
                  name={getControlName(controlPrefix, `PatternColor${index + 1}`)}
                  value={pattern?.colors?.[index]}
                  effectiveValue={color}
                  onChange={(nextColor) => {
                    const base = materializeBackgroundPatternPreset(pattern ?? structuredPattern, presetId);
                    const colors = [...(base.colors ?? [])];
                    colors[index] = nextColor;
                    onChange({ ...base, colors });
                  }}
                />
              </label>
            </div>
          ))}
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>{t("inspector.pattern.size")}</span>
              <div className={styles.unitInput}>
                <input
                  id={`${controlPrefix}-background-pattern-size`}
                  name={getControlName(controlPrefix, "BackgroundPatternSize")}
                  type="number"
                  min="1"
                  max="500"
                  step="1"
                  value={getPatternSizeValue(structuredPattern, presetId)}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (!Number.isFinite(next) || next <= 0) return;
                    const base = materializeBackgroundPatternPreset(pattern ?? structuredPattern, presetId);
                    updateContinuous("number:container-pattern-size", () => onChange(updateBackgroundPatternSize(base, presetId, next)));
                  }}
                  onBlur={() => authoringHistory?.finish("number:container-pattern-size")}
                />
                <span>px</span>
              </div>
            </label>
            <label className={styles.field}>
              <span>{t("inspector.pattern.rotation")}</span>
              <div className={styles.unitInput}>
                <input
                  id={`${controlPrefix}-background-pattern-rotation`}
                  name={getControlName(controlPrefix, "BackgroundPatternRotation")}
                  type="number"
                  min="-360"
                  max="360"
                  step="1"
                  value={structuredPattern.rotation ?? 0}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (!Number.isFinite(next)) return;
                    const base = materializeBackgroundPatternPreset(pattern ?? structuredPattern, presetId);
                    updateContinuous("number:container-pattern-rotation", () => onChange(updateBackgroundPatternRotation(base, next)));
                  }}
                  onBlur={() => authoringHistory?.finish("number:container-pattern-rotation")}
                />
                <span>°</span>
              </div>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
