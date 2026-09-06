import type { PlotElement, PlotVisualStyle } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import { InspectorSection } from "./inspector-section";
import type { TypedInspectorProps } from "./inspector-types";
import { ColorControl } from "./sections/color-control";

const DEFAULT_PLOT_Z_GRADIENT = {
  minColor: "#7c3aed",
  maxColor: "#06b6d4",
} as const;

function normalizePlotStyle(style: PlotVisualStyle | undefined): PlotVisualStyle | undefined {
  if (style === undefined) return undefined;
  const background = style.background?.color === undefined ? undefined : style.background;
  const next = { ...style, ...(background === undefined ? { background: undefined } : { background }) };
  if (next.color === undefined && next.background === undefined && next.zGradient === undefined) return undefined;
  return next;
}

export function PlotInspector({
  element,
  onUpdate,
}: TypedInspectorProps<PlotElement>) {
  const { t } = useStudioI18n();
  const updateStyle = (update: (style: PlotVisualStyle | undefined) => PlotVisualStyle | undefined) => {
    onUpdate((current) => current.type === "plot"
      ? { ...current, style: normalizePlotStyle(update(current.style)) }
      : current);
  };

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
            onChange={(event) => {
              const source = event.target.value;

              onUpdate((current) => {
                if (current.type !== "plot") {
                  return current;
                }

                return {
                  ...current,
                  source,
                };
              });
            }}
          />
        </label>

      </InspectorSection>

      <InspectorSection title={t("inspector.appearance")} defaultOpen>
        <label className={styles.checkboxRow}>
          <input
            id="plot-fit-to-axes"
            name="plotFitToAxes"
            type="checkbox"
            checked={element.fitToAxes !== false}
            onChange={(event) => {
              onUpdate((current) => current.type === "plot"
                ? { ...current, fitToAxes: event.target.checked }
                : current);
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
              onUpdate((current) => current.type === "plot"
                ? { ...current, showAxes: event.target.checked }
                : current);
            }}
          />
          <span>{t("inspector.showAxes")}</span>
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
              updateStyle((current) => {
                const next = { ...(current ?? {}) };
                if (mode === "z") {
                  next.zGradient = current?.zGradient ?? DEFAULT_PLOT_Z_GRADIENT;
                } else {
                  delete next.zGradient;
                }
                return next;
              });
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
