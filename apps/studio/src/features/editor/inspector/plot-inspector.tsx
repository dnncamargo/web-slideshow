import { useState } from "react";

import {
  PlotAnimationSchema,
  type PlotAnimation,
  type PlotElement,
  type PlotVisualStyle,
} from "@web-slideshow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import { InspectorSection } from "./inspector-section";
import type { PlotPreviewControls, TypedInspectorProps } from "./inspector-types";
import { ColorControl } from "./sections/color-control";
import { CanonicalElementSizeSection } from "./sections/canonical-element-size-section";
import { ElementSpacingSection } from "./sections/element-spacing-section";
import { useAuthoringHistory } from "../authoring-history-context";

const DEFAULT_PLOT_Z_GRADIENT = {
  minColor: "#7c3aed",
  maxColor: "#06b6d4",
} as const;

const DEFAULT_PLOT_ANIMATION = {
  parameter: "t",
  from: "0",
  to: "6.283185307179586",
  durationMs: "4000",
  loop: true,
  autoplay: true,
} as const;

const numberChangeHistoryMeta = {
  kind: "number.change",
  labelKey: "history.number.change",
} as const;

type PlotAnimationDraft = {
  enabled: boolean;
  parameter: string;
  from: string;
  to: string;
  durationMs: string;
  loop: boolean;
  autoplay: boolean;
};

function plotAnimationDraft(animation: PlotAnimation | undefined): PlotAnimationDraft {
  return animation === undefined
    ? { enabled: false, ...DEFAULT_PLOT_ANIMATION }
    : {
      enabled: true,
      parameter: animation.parameter,
      from: String(animation.from),
      to: String(animation.to),
      durationMs: String(animation.durationMs),
      loop: animation.loop !== false,
      autoplay: animation.autoplay !== false,
    };
}

function animationIdentity(animation: PlotAnimation | undefined): string {
  return JSON.stringify(animation ?? null);
}

function plotStyleIdentity(style: PlotVisualStyle | undefined): string {
  return JSON.stringify(style ?? null);
}

function normalizePlotStyle(style: PlotVisualStyle | undefined): PlotVisualStyle | undefined {
  if (style === undefined) return undefined;
  const background = style.background?.color === undefined ? undefined : style.background;
  const axes = style.axes?.color === undefined && style.axes?.strokeWidth === undefined
    && style.axes?.opacity === undefined
    ? undefined
    : style.axes;
  const next = { ...style };
  if (background === undefined) delete next.background;
  else next.background = background;
  if (axes === undefined) delete next.axes;
  else next.axes = axes;
  if (next.color === undefined && next.background === undefined && next.zGradient === undefined && next.axes === undefined) return undefined;
  return next;
}

export function PlotInspector({
  element,
  onUpdate,
  previewControls,
}: TypedInspectorProps<PlotElement> & { previewControls?: PlotPreviewControls }) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const sourceHistoryKey = `text:plot-${element.id}-source`;
  const textEditMeta = { kind: "text.edit", labelKey: "history.text.edit" } as const;
  const runDiscrete = (setting: string, callback: () => void): void => {
    const meta = {
      kind: "element.setting",
      labelKey: "history.element.setting",
      labelParams: { setting },
    } as const;
    if (authoringHistory) authoringHistory.discrete(meta, callback);
    else callback();
  };
  const [animationDraft, setAnimationDraft] = useState<PlotAnimationDraft>(() => plotAnimationDraft(element.animation));
  const [hydratedAnimation, setHydratedAnimation] = useState({
    id: element.id,
    animation: animationIdentity(element.animation),
  });
  const [animationMessage, setAnimationMessage] = useState<string | null>(null);
  const [axisStrokeWidthDraft, setAxisStrokeWidthDraft] = useState(
    element.style?.axes?.strokeWidth === undefined ? "" : String(element.style.axes.strokeWidth),
  );
  const [axisOpacityDraft, setAxisOpacityDraft] = useState(
    element.style?.axes?.opacity === undefined ? "" : String(element.style.axes.opacity * 100),
  );
  const [hydratedAxisStyle, setHydratedAxisStyle] = useState({
    id: element.id,
    style: JSON.stringify(element.style?.axes ?? null),
  });

  const currentAnimationIdentity = animationIdentity(element.animation);
  if (
    hydratedAnimation.id !== element.id ||
    hydratedAnimation.animation !== currentAnimationIdentity
  ) {
    setHydratedAnimation({ id: element.id, animation: currentAnimationIdentity });
    setAnimationDraft(plotAnimationDraft(element.animation));
    setAnimationMessage(null);
  }

  const currentAxisStyleIdentity = JSON.stringify(element.style?.axes ?? null);
  if (hydratedAxisStyle.id !== element.id || hydratedAxisStyle.style !== currentAxisStyleIdentity) {
    setHydratedAxisStyle({ id: element.id, style: currentAxisStyleIdentity });
    setAxisStrokeWidthDraft(element.style?.axes?.strokeWidth === undefined ? "" : String(element.style.axes.strokeWidth));
    setAxisOpacityDraft(element.style?.axes?.opacity === undefined ? "" : String(element.style.axes.opacity * 100));
  }

  const animationDirty = JSON.stringify(animationDraft) !== JSON.stringify(plotAnimationDraft(element.animation));

  function updateAnimationDraft(update: Partial<PlotAnimationDraft>): void {
    setAnimationDraft((current) => ({ ...current, ...update }));
    setAnimationMessage(null);
  }

  function applyAnimationDraft(): void {
    if (!animationDraft.enabled) {
      if (element.animation === undefined) return;
      runDiscrete("plot.animation", () => onUpdate((current) => {
        if (current.type !== "plot" || current.animation === undefined) return current;
        const next = { ...current };
        delete next.animation;
        return next;
      }));
      return;
    }

    const parseNumber = (value: string): number | undefined => {
      if (value.trim() === "") return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    const from = parseNumber(animationDraft.from);
    const to = parseNumber(animationDraft.to);
    const durationMs = parseNumber(animationDraft.durationMs);
    const candidate = {
      parameter: animationDraft.parameter,
      from,
      to,
      durationMs,
      ...(animationDraft.loop ? {} : { loop: false }),
      ...(animationDraft.autoplay ? {} : { autoplay: false }),
    };
    const parsed = PlotAnimationSchema.safeParse(candidate);
    if (!parsed.success) {
      setAnimationMessage(t("inspector.animation.invalid"));
      return;
    }

    if (animationIdentity(parsed.data) === animationIdentity(element.animation)) {
      setAnimationMessage(null);
      return;
    }

    setAnimationMessage(null);
    runDiscrete("plot.animation", () => onUpdate((current) => current.type === "plot"
      ? { ...current, animation: parsed.data }
      : current));
  }

  function resetAnimationDraft(): void {
    setAnimationDraft(plotAnimationDraft(element.animation));
    setAnimationMessage(null);
  }

  const updateStyle = (update: (style: PlotVisualStyle | undefined) => PlotVisualStyle | undefined) => {
    onUpdate((current) => current.type === "plot"
      ? { ...current, style: normalizePlotStyle(update(current.style)) }
      : current);
  };

  const commitAxisStyle = (update: (style: PlotVisualStyle | undefined) => PlotVisualStyle | undefined): void => {
    const nextStyle = normalizePlotStyle(update(element.style));
    if (plotStyleIdentity(nextStyle) === plotStyleIdentity(element.style)) return;

    const apply = () => onUpdate((current) => {
      if (current.type !== "plot") return current;
      const currentStyle = current.style;
      const recomputedStyle = normalizePlotStyle(update(currentStyle));
      if (plotStyleIdentity(recomputedStyle) === plotStyleIdentity(currentStyle)) return current;
      return { ...current, style: recomputedStyle };
    });

    if (authoringHistory) authoringHistory.discrete(numberChangeHistoryMeta, apply);
    else apply();
  };

  function commitAxisStrokeWidth(value = axisStrokeWidthDraft): void {
    if (value.trim() === "") {
      commitAxisStyle((current) => {
        if (current?.axes === undefined) return current;
        const next = { ...current, axes: { ...current.axes } };
        delete next.axes.strokeWidth;
        return next;
      });
      return;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    commitAxisStyle((current) => ({
      ...(current ?? {}),
      axes: { ...(current?.axes ?? {}), strokeWidth: parsed },
    }));
  }

  function commitAxisOpacity(value = axisOpacityDraft): void {
    if (value.trim() === "") {
      commitAxisStyle((current) => {
        if (current?.axes === undefined) return current;
        const next = { ...current, axes: { ...current.axes } };
        delete next.axes.opacity;
        return next;
      });
      return;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return;
    commitAxisStyle((current) => ({
      ...(current ?? {}),
      axes: { ...(current?.axes ?? {}), opacity: parsed / 100 },
    }));
  }

  return (
    <>
      <div className={styles.inspectorDivider} />

      <InspectorSection title={t("inspector.content")} defaultOpen>
        <label className={styles.field}>
          <span>{t("inspector.source")}</span>

          <textarea
            id="plot-source"
            name="plotSource"
            className={`${styles.textArea} ${styles.codeTextArea}`}
            rows={6}
            spellCheck={false}
            value={element.source}
            maxLength={4096}
            onFocus={() => authoringHistory?.begin(sourceHistoryKey, textEditMeta)}
            onBlur={() => authoringHistory?.finish(sourceHistoryKey)}
            onChange={(event) => {
              const source = event.target.value;
              if (source === element.source) {
                return;
              }

              authoringHistory?.begin(sourceHistoryKey, textEditMeta);
              const update = () => onUpdate((current) => {
                if (current.type !== "plot" || current.source === source) {
                  return current;
                }

                return {
                  ...current,
                  source,
                };
              });

              if (authoringHistory) {
                authoringHistory.update(sourceHistoryKey, update);
              } else {
                update();
              }
            }}
          />
        </label>

      </InspectorSection>

      <InspectorSection title={t("inspector.animation")} defaultOpen>
        <label className={styles.checkboxRow}>
          <input
            id="plot-animation-enabled"
            name="plotAnimationEnabled"
            type="checkbox"
            checked={animationDraft.enabled}
            onChange={(event) => updateAnimationDraft({ enabled: event.target.checked })}
          />
          <span>{t("inspector.animation.enabled")}</span>
        </label>

        {animationDraft.enabled ? (
          <>
            <label className={styles.field}>
              <span>{t("inspector.animation.parameter")}</span>
              <input
                id="plot-animation-parameter"
                name="plotAnimationParameter"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={animationDraft.parameter}
                onChange={(event) => updateAnimationDraft({ parameter: event.target.value })}
              />
            </label>

            <label className={styles.field}>
              <span>{t("inspector.animation.from")}</span>
              <input
                id="plot-animation-from"
                name="plotAnimationFrom"
                type="text"
                inputMode="decimal"
                value={animationDraft.from}
                onChange={(event) => updateAnimationDraft({ from: event.target.value })}
              />
            </label>

            <label className={styles.field}>
              <span>{t("inspector.animation.to")}</span>
              <input
                id="plot-animation-to"
                name="plotAnimationTo"
                type="text"
                inputMode="decimal"
                value={animationDraft.to}
                onChange={(event) => updateAnimationDraft({ to: event.target.value })}
              />
            </label>

            <label className={styles.field}>
              <span>{t("inspector.animation.durationMs")}</span>
              <input
                id="plot-animation-duration"
                name="plotAnimationDuration"
                type="text"
                inputMode="decimal"
                value={animationDraft.durationMs}
                onChange={(event) => updateAnimationDraft({ durationMs: event.target.value })}
              />
            </label>

            <label className={styles.checkboxRow}>
              <input
                id="plot-animation-loop"
                name="plotAnimationLoop"
                type="checkbox"
                checked={animationDraft.loop}
                onChange={(event) => updateAnimationDraft({ loop: event.target.checked })}
              />
              <span>{t("inspector.animation.loop")}</span>
            </label>

            <label className={styles.checkboxRow}>
              <input
                id="plot-animation-autoplay"
                name="plotAnimationAutoplay"
                type="checkbox"
                checked={animationDraft.autoplay}
                onChange={(event) => updateAnimationDraft({ autoplay: event.target.checked })}
              />
              <span>{t("inspector.animation.autoplay")}</span>
            </label>
          </>
        ) : null}

        {animationMessage !== null && (
          <small className={styles.fieldHint}><span>{animationMessage}</span></small>
        )}

        <div className={styles.elementCrudActions}>
          <button
            id="plot-animation-apply"
            type="button"
            className={styles.secondaryButton}
            disabled={!animationDirty}
            onClick={applyAnimationDraft}
          >
            <span>{t("inspector.animation.apply")}</span>
          </button>
          <button
            id="plot-animation-reset"
            type="button"
            className={styles.secondaryButton}
            disabled={!animationDirty}
            onClick={resetAnimationDraft}
          >
            <span>{t("inspector.animation.reset")}</span>
          </button>
        </div>

        {element.animation !== undefined && previewControls !== undefined ? (
          <div className={styles.elementCrudActions}>
            <button
              id="plot-animation-preview-play"
              type="button"
              className={styles.secondaryButton}
              onClick={previewControls.onPlay}
            >
              <span>{t("inspector.animation.previewPlay")}</span>
            </button>
            <button
              id="plot-animation-preview-pause"
              type="button"
              className={styles.secondaryButton}
              onClick={previewControls.onPause}
            >
              <span>{t("inspector.animation.previewPause")}</span>
            </button>
            <button
              id="plot-animation-preview-reset"
              type="button"
              className={styles.secondaryButton}
              onClick={previewControls.onReset}
            >
              <span>{t("inspector.animation.previewReset")}</span>
            </button>
          </div>
        ) : null}
      </InspectorSection>

      <CanonicalElementSizeSection
        layout={element.layout}
        onUpdateLayout={(update) => {
          onUpdate((current) => current.type === "plot"
            ? { ...current, layout: update(current.layout) }
            : current);
        }}
      />

      <ElementSpacingSection
        layout={element.layout}
        controlPrefix="plot"
        onUpdateLayout={(update) => {
          onUpdate((current) => current.type === "plot"
            ? { ...current, layout: update(current.layout) }
            : current);
        }}
      />

      <InspectorSection title={t("inspector.appearance")} defaultOpen>
        <label className={styles.checkboxRow}>
          <input
            id="plot-fit-to-axes"
            name="plotFitToAxes"
            type="checkbox"
            checked={element.fitToAxes !== false}
            onChange={(event) => {
              if ((element.fitToAxes !== false) === event.target.checked) return;
              runDiscrete("plot.fitToAxes", () => onUpdate((current) => current.type === "plot"
                ? { ...current, fitToAxes: event.target.checked }
                : current));
            }}
          />
          <span>{t("inspector.fitToAxes")}</span>
        </label>

        <label className={styles.checkboxRow}>
          <input
            id="plot-show-axes"
            name="plotShowAxes"
            type="checkbox"
            checked={element.showAxes !== false}
            onChange={(event) => {
              if ((element.showAxes !== false) === event.target.checked) return;
              runDiscrete("plot.showAxes", () => onUpdate((current) => current.type === "plot"
                ? { ...current, showAxes: event.target.checked }
                : current));
            }}
          />
          <span>{t("inspector.showAxes")}</span>
        </label>

        <label className={styles.field}>
          <span>{t("inspector.axisColor")}</span>
          <ColorControl
            id="plot-axis-color"
            name="plotAxisColor"
            value={element.style?.axes?.color}
            onChange={(color) => updateStyle((current) => ({
              ...(current ?? {}),
              axes: { ...(current?.axes ?? {}), color },
            }))}
            secondaryAction={{
              label: t("inspector.remove"),
              onClick: () => updateStyle((current) => {
                if (current?.axes === undefined) return current;
                const next = { ...current, axes: { ...current.axes } };
                delete next.axes.color;
                return next;
              }),
            }}
          />
        </label>

        <label className={styles.field}>
          <span>{t("inspector.axisOpacity")}</span>
          <div className={styles.unitInput}>
            <input
              id="plot-axis-opacity"
              name="plotAxisOpacity"
              type="number"
              min="0"
              max="100"
              step="1"
              placeholder="70"
              value={axisOpacityDraft}
              onChange={(event) => setAxisOpacityDraft(event.target.value)}
              onBlur={(event) => commitAxisOpacity(event.currentTarget.value)}
            />
            <span>%</span>
          </div>
        </label>

        <label className={styles.field}>
          <span>{t("inspector.axisThickness")}</span>
          <input
            id="plot-axis-stroke-width"
            name="plotAxisStrokeWidth"
            type="text"
            inputMode="decimal"
            placeholder="1"
            value={axisStrokeWidthDraft}
            onChange={(event) => setAxisStrokeWidthDraft(event.target.value)}
            onBlur={(event) => commitAxisStrokeWidth(event.currentTarget.value)}
          />
        </label>

        <label className={styles.field}>
          <span>{t("inspector.color")}</span>
          <ColorControl
            id="plot-color"
            name="plotColor"
            value={element.style?.color}
            onChange={(color) => updateStyle((current) => ({ ...(current ?? {}), color }))}
            secondaryAction={{
              label: t("inspector.remove"),
              onClick: () => updateStyle((current) => {
                if (current === undefined) return undefined;
                const next = { ...current };
                delete next.color;
                return next;
              }),
            }}
          />
        </label>

        <label className={styles.field}>
          <span>{t("inspector.background")}</span>
          <ColorControl
            id="plot-background"
            name="plotBackground"
            value={element.style?.background?.color}
            onChange={(color) => updateStyle((current) => ({
              ...(current ?? {}),
              background: { color },
            }))}
            secondaryAction={{
              label: t("inspector.remove"),
              onClick: () => updateStyle((current) => {
                if (current === undefined) return undefined;
                const next = { ...current };
                delete next.background;
                return next;
              }),
            }}
          />
        </label>

        <label className={styles.field}>
          <span>{t("inspector.plot3dColor")}</span>
          <select
            id="plot-z-color-mode"
            name="plotZColorMode"
            value={element.style?.zGradient === undefined ? "solid" : "z"}
            onChange={(event) => {
              const mode = event.target.value;
              const currentMode = element.style?.zGradient === undefined ? "solid" : "z";
              if (mode === currentMode) return;
              runDiscrete("plot.zColorMode", () => updateStyle((current) => {
                const next = { ...(current ?? {}) };
                if (mode === "z") {
                  next.zGradient = current?.zGradient ?? DEFAULT_PLOT_Z_GRADIENT;
                } else {
                  delete next.zGradient;
                }
                return next;
              }));
            }}
          >
            <option value="solid">{t("inspector.plot3dColor.solid")}</option>
            <option value="z">{t("inspector.plot3dColor.byZ")}</option>
          </select>
        </label>

        {element.style?.zGradient !== undefined ? (
          <>
            <label className={styles.field}>
              <span>{t("inspector.plot3dColor.min")}</span>
              <ColorControl
                id="plot-z-min-color"
                name="plotZMinColor"
                value={element.style.zGradient.minColor}
                onChange={(color) => updateStyle((current) => ({
                  ...(current ?? {}),
                  zGradient: {
                    ...(current?.zGradient ?? DEFAULT_PLOT_Z_GRADIENT),
                    minColor: color,
                  },
                }))}
              />
            </label>

            <label className={styles.field}>
              <span>{t("inspector.plot3dColor.max")}</span>
              <ColorControl
                id="plot-z-max-color"
                name="plotZMaxColor"
                value={element.style.zGradient.maxColor}
                onChange={(color) => updateStyle((current) => ({
                  ...(current ?? {}),
                  zGradient: {
                    ...(current?.zGradient ?? DEFAULT_PLOT_Z_GRADIENT),
                    maxColor: color,
                  },
                }))}
              />
            </label>
          </>
        ) : null}
      </InspectorSection>
    </>
  );
}
