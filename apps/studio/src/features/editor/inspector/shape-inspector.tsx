import { useState } from "react";

import {
  ShapeAnimationSchema,
  type ShapeAnimation,
  type ShapeElement,
} from "@web-slideshow/document-schema";

import { CanonicalElementSizeSection } from "./sections/canonical-element-size-section";
import { ElementInteractionSection } from "./sections/element-interaction-section";
import { ShapeAppearanceSection } from "./sections/shape-appearance-section";
import { ShapeEffectsSection } from "./sections/shape-effects-section";
import { ShapeGeometrySection } from "./sections/shape-geometry-section";
import type { ShapePreviewControls, TypedInspectorProps } from "./inspector-types";
import type { ElementEffect } from "@web-slideshow/document-schema";
import { InspectorSection } from "./inspector-section";
import styles from "../editor-workspace.module.css";
import { useAuthoringHistory } from "../authoring-history-context";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

const DEFAULT_SHAPE_ANIMATION = {
  durationMs: "2000",
  loop: true,
  autoplay: true,
  rotateFromDeg: "0",
  rotateToDeg: "360",
  translateFromXPercent: "0",
  translateFromYPercent: "0",
  translateToXPercent: "20",
  translateToYPercent: "0",
  skewFromXDeg: "0",
  skewFromYDeg: "0",
  skewToXDeg: "20",
  skewToYDeg: "0",
} as const;

type ShapeAnimationDraft = {
  enabled: boolean;
  rotateEnabled: boolean;
  rotateFromDeg: string;
  rotateToDeg: string;
  translateEnabled: boolean;
  translateFromXPercent: string;
  translateFromYPercent: string;
  translateToXPercent: string;
  translateToYPercent: string;
  skewEnabled: boolean;
  skewFromXDeg: string;
  skewFromYDeg: string;
  skewToXDeg: string;
  skewToYDeg: string;
  durationMs: string;
  loop: boolean;
  autoplay: boolean;
};

function shapeAnimationDraft(animation: ShapeAnimation | undefined): ShapeAnimationDraft {
  return animation === undefined
    ? {
      enabled: false,
      rotateEnabled: false,
      translateEnabled: false,
      skewEnabled: false,
      ...DEFAULT_SHAPE_ANIMATION,
    }
    : {
      enabled: true,
      rotateEnabled: animation.rotate !== undefined,
      rotateFromDeg: String(animation.rotate?.fromDeg ?? DEFAULT_SHAPE_ANIMATION.rotateFromDeg),
      rotateToDeg: String(animation.rotate?.toDeg ?? DEFAULT_SHAPE_ANIMATION.rotateToDeg),
      translateEnabled: animation.translate !== undefined,
      translateFromXPercent: String(animation.translate?.fromXPercent ?? DEFAULT_SHAPE_ANIMATION.translateFromXPercent),
      translateFromYPercent: String(animation.translate?.fromYPercent ?? DEFAULT_SHAPE_ANIMATION.translateFromYPercent),
      translateToXPercent: String(animation.translate?.toXPercent ?? DEFAULT_SHAPE_ANIMATION.translateToXPercent),
      translateToYPercent: String(animation.translate?.toYPercent ?? DEFAULT_SHAPE_ANIMATION.translateToYPercent),
      skewEnabled: animation.skew !== undefined,
      skewFromXDeg: String(animation.skew?.fromXDeg ?? DEFAULT_SHAPE_ANIMATION.skewFromXDeg),
      skewFromYDeg: String(animation.skew?.fromYDeg ?? DEFAULT_SHAPE_ANIMATION.skewFromYDeg),
      skewToXDeg: String(animation.skew?.toXDeg ?? DEFAULT_SHAPE_ANIMATION.skewToXDeg),
      skewToYDeg: String(animation.skew?.toYDeg ?? DEFAULT_SHAPE_ANIMATION.skewToYDeg),
      durationMs: String(animation.durationMs),
      loop: animation.loop !== false,
      autoplay: animation.autoplay !== false,
    };
}

function animationIdentity(animation: ShapeAnimation | undefined): string {
  return JSON.stringify(animation ?? null);
}

function parseNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeEffect(effect: ElementEffect): ElementEffect | undefined {
  return effect.opacity === undefined && effect.shadow === undefined
    ? undefined
    : effect;
}

export function ShapeInspector({
  element,
  onUpdate,
  previewControls,
}: TypedInspectorProps<ShapeElement> & { previewControls?: ShapePreviewControls }) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const [animationDraft, setAnimationDraft] = useState<ShapeAnimationDraft>(() => shapeAnimationDraft(element.animation));
  const [hydratedAnimation, setHydratedAnimation] = useState({
    id: element.id,
    animation: animationIdentity(element.animation),
  });
  const [animationMessage, setAnimationMessage] = useState<string | null>(null);

  const currentAnimationIdentity = animationIdentity(element.animation);
  if (hydratedAnimation.id !== element.id || hydratedAnimation.animation !== currentAnimationIdentity) {
    setHydratedAnimation({ id: element.id, animation: currentAnimationIdentity });
    setAnimationDraft(shapeAnimationDraft(element.animation));
    setAnimationMessage(null);
  }

  const runDiscrete = (setting: string, callback: () => void): void => {
    const meta = {
      kind: "element.setting",
      labelKey: "history.element.setting",
      labelParams: { setting },
    } as const;
    if (authoringHistory) authoringHistory.discrete(meta, callback);
    else callback();
  };

  const animationDirty = JSON.stringify(animationDraft) !== JSON.stringify(shapeAnimationDraft(element.animation));

  function updateAnimationDraft(update: Partial<ShapeAnimationDraft>): void {
    setAnimationDraft((current) => ({ ...current, ...update }));
    setAnimationMessage(null);
  }

  function applyAnimationDraft(): void {
    if (!animationDraft.enabled) {
      if (element.animation === undefined) return;
      runDiscrete("shape.animation", () => onUpdate((current) => {
        if (current.type !== "shape" || current.animation === undefined) return current;
        const next = { ...current };
        delete next.animation;
        return next;
      }));
      return;
    }

    const durationMs = parseNumber(animationDraft.durationMs);
    const rotateValues = [parseNumber(animationDraft.rotateFromDeg), parseNumber(animationDraft.rotateToDeg)];
    const translateValues = [
      parseNumber(animationDraft.translateFromXPercent),
      parseNumber(animationDraft.translateFromYPercent),
      parseNumber(animationDraft.translateToXPercent),
      parseNumber(animationDraft.translateToYPercent),
    ];
    const skewValues = [
      parseNumber(animationDraft.skewFromXDeg),
      parseNumber(animationDraft.skewFromYDeg),
      parseNumber(animationDraft.skewToXDeg),
      parseNumber(animationDraft.skewToYDeg),
    ];
    const candidate = {
      durationMs,
      ...(animationDraft.loop ? {} : { loop: false }),
      ...(animationDraft.autoplay ? {} : { autoplay: false }),
      ...(animationDraft.rotateEnabled && rotateValues.every((value): value is number => value !== undefined)
        ? { rotate: { fromDeg: rotateValues[0], toDeg: rotateValues[1] } }
        : {}),
      ...(animationDraft.translateEnabled && translateValues.every((value): value is number => value !== undefined)
        ? {
            translate: {
              fromXPercent: translateValues[0],
              fromYPercent: translateValues[1],
              toXPercent: translateValues[2],
              toYPercent: translateValues[3],
            },
          }
        : {}),
      ...(animationDraft.skewEnabled && skewValues.every((value): value is number => value !== undefined)
        ? {
            skew: {
              fromXDeg: skewValues[0],
              fromYDeg: skewValues[1],
              toXDeg: skewValues[2],
              toYDeg: skewValues[3],
            },
          }
        : {}),
    };
    const parsed = ShapeAnimationSchema.safeParse(candidate);
    if (!parsed.success) {
      setAnimationMessage(t("inspector.animation.invalid"));
      return;
    }
    if (animationIdentity(parsed.data) === animationIdentity(element.animation)) {
      setAnimationMessage(null);
      return;
    }

    setAnimationMessage(null);
    runDiscrete("shape.animation", () => onUpdate((current) => current.type === "shape"
      ? { ...current, animation: parsed.data }
      : current));
  }

  function resetAnimationDraft(): void {
    setAnimationDraft(shapeAnimationDraft(element.animation));
    setAnimationMessage(null);
  }

  return (
    <>
      <ShapeGeometrySection
        element={element}
        onUpdate={(update) => onUpdate((current) => current.type === "shape" ? update(current) : current)}
      />

      <InspectorSection title={t("inspector.animation")} defaultOpen>
        <label className={styles.checkboxRow}>
          <input
            id="shape-animation-enabled"
            name="shapeAnimationEnabled"
            type="checkbox"
            checked={animationDraft.enabled}
            onChange={(event) => updateAnimationDraft({ enabled: event.target.checked })}
          />
          <span>{t("inspector.animation.enable")}</span>
        </label>

        {animationDraft.enabled ? (
          <>
            <div className={styles.inspectorGroup}>
              <strong>{t("inspector.animation.rotation")}</strong>
              <label className={styles.checkboxRow}>
                <input
                  id="shape-animation-rotate-enabled"
                  type="checkbox"
                  checked={animationDraft.rotateEnabled}
                  onChange={(event) => updateAnimationDraft({ rotateEnabled: event.target.checked })}
                />
                <span>{t("inspector.animation.channelEnabled")}</span>
              </label>
              {animationDraft.rotateEnabled ? (
                <>
                  <label className={styles.field}>
                    <span>{t("inspector.animation.fromDeg")}</span>
                    <input id="shape-animation-rotate-from" type="number" step="1" value={animationDraft.rotateFromDeg} onChange={(event) => updateAnimationDraft({ rotateFromDeg: event.target.value })} />
                  </label>
                  <label className={styles.field}>
                    <span>{t("inspector.animation.toDeg")}</span>
                    <input id="shape-animation-rotate-to" type="number" step="1" value={animationDraft.rotateToDeg} onChange={(event) => updateAnimationDraft({ rotateToDeg: event.target.value })} />
                  </label>
                </>
              ) : null}
            </div>

            <div className={styles.inspectorGroup}>
              <strong>{t("inspector.animation.translation")}</strong>
              <label className={styles.checkboxRow}>
                <input
                  id="shape-animation-translate-enabled"
                  type="checkbox"
                  checked={animationDraft.translateEnabled}
                  onChange={(event) => updateAnimationDraft({ translateEnabled: event.target.checked })}
                />
                <span>{t("inspector.animation.channelEnabled")}</span>
              </label>
              {animationDraft.translateEnabled ? (
                <>
                  <label className={styles.field}><span>{t("inspector.animation.fromX")}</span><input id="shape-animation-translate-from-x" type="number" step="1" value={animationDraft.translateFromXPercent} onChange={(event) => updateAnimationDraft({ translateFromXPercent: event.target.value })} /><span>%</span></label>
                  <label className={styles.field}><span>{t("inspector.animation.fromY")}</span><input id="shape-animation-translate-from-y" type="number" step="1" value={animationDraft.translateFromYPercent} onChange={(event) => updateAnimationDraft({ translateFromYPercent: event.target.value })} /><span>%</span></label>
                  <label className={styles.field}><span>{t("inspector.animation.toX")}</span><input id="shape-animation-translate-to-x" type="number" step="1" value={animationDraft.translateToXPercent} onChange={(event) => updateAnimationDraft({ translateToXPercent: event.target.value })} /><span>%</span></label>
                  <label className={styles.field}><span>{t("inspector.animation.toY")}</span><input id="shape-animation-translate-to-y" type="number" step="1" value={animationDraft.translateToYPercent} onChange={(event) => updateAnimationDraft({ translateToYPercent: event.target.value })} /><span>%</span></label>
                </>
              ) : null}
            </div>

            <div className={styles.inspectorGroup}>
              <strong>{t("inspector.animation.skew")}</strong>
              <label className={styles.checkboxRow}>
                <input
                  id="shape-animation-skew-enabled"
                  type="checkbox"
                  checked={animationDraft.skewEnabled}
                  onChange={(event) => updateAnimationDraft({ skewEnabled: event.target.checked })}
                />
                <span>{t("inspector.animation.channelEnabled")}</span>
              </label>
              {animationDraft.skewEnabled ? (
                <>
                  <label className={styles.field}><span>{t("inspector.animation.fromXDeg")}</span><input id="shape-animation-skew-from-x" type="number" step="1" value={animationDraft.skewFromXDeg} onChange={(event) => updateAnimationDraft({ skewFromXDeg: event.target.value })} /><span>°</span></label>
                  <label className={styles.field}><span>{t("inspector.animation.fromYDeg")}</span><input id="shape-animation-skew-from-y" type="number" step="1" value={animationDraft.skewFromYDeg} onChange={(event) => updateAnimationDraft({ skewFromYDeg: event.target.value })} /><span>°</span></label>
                  <label className={styles.field}><span>{t("inspector.animation.toXDeg")}</span><input id="shape-animation-skew-to-x" type="number" step="1" value={animationDraft.skewToXDeg} onChange={(event) => updateAnimationDraft({ skewToXDeg: event.target.value })} /><span>°</span></label>
                  <label className={styles.field}><span>{t("inspector.animation.toYDeg")}</span><input id="shape-animation-skew-to-y" type="number" step="1" value={animationDraft.skewToYDeg} onChange={(event) => updateAnimationDraft({ skewToYDeg: event.target.value })} /><span>°</span></label>
                </>
              ) : null}
            </div>

            <label className={styles.field}>
              <span>{t("inspector.animation.durationMs")}</span>
              <input id="shape-animation-duration" type="number" min="1" step="1" value={animationDraft.durationMs} onChange={(event) => updateAnimationDraft({ durationMs: event.target.value })} />
            </label>
            <label className={styles.checkboxRow}><input id="shape-animation-loop" type="checkbox" checked={animationDraft.loop} onChange={(event) => updateAnimationDraft({ loop: event.target.checked })} /><span>{t("inspector.animation.loop")}</span></label>
            <label className={styles.checkboxRow}><input id="shape-animation-autoplay" type="checkbox" checked={animationDraft.autoplay} onChange={(event) => updateAnimationDraft({ autoplay: event.target.checked })} /><span>{t("inspector.animation.autoplay")}</span></label>
          </>
        ) : null}

        {animationMessage !== null ? <small className={styles.fieldHint}><span>{animationMessage}</span></small> : null}
        <div className={styles.elementCrudActions}>
          <button id="shape-animation-apply" type="button" className={styles.secondaryButton} disabled={!animationDirty} onClick={applyAnimationDraft}><span>{t("inspector.animation.apply")}</span></button>
          <button id="shape-animation-reset" type="button" className={styles.secondaryButton} disabled={!animationDirty} onClick={resetAnimationDraft}><span>{t("inspector.animation.reset")}</span></button>
        </div>
        {element.animation !== undefined && previewControls !== undefined ? (
          <div className={styles.elementCrudActions}>
            <button id="shape-animation-preview-play" type="button" className={styles.secondaryButton} onClick={previewControls.onPlay}><span>{t("inspector.animation.previewPlay")}</span></button>
            <button id="shape-animation-preview-pause" type="button" className={styles.secondaryButton} onClick={previewControls.onPause}><span>{t("inspector.animation.previewPause")}</span></button>
            <button id="shape-animation-preview-reset" type="button" className={styles.secondaryButton} onClick={previewControls.onReset}><span>{t("inspector.animation.previewReset")}</span></button>
          </div>
        ) : null}
      </InspectorSection>

      <CanonicalElementSizeSection
        layout={element.layout}
        onUpdateLayout={(update) => {
          onUpdate((current) => current.type === "shape"
            ? { ...current, layout: update(current.layout) }
            : current);
        }}
      />

      <ShapeAppearanceSection
        elementId={element.id}
        style={element.style}
        onUpdateStyle={(update) => onUpdate((current) => current.type === "shape" ? { ...current, style: update(current.style) } : current)}
      />

      <ShapeEffectsSection
        effect={element.effect}
        onUpdateEffect={(update) => onUpdate((current) => {
          if (current.type !== "shape") return current;
          return { ...current, effect: normalizeEffect(update(current.effect)) };
        })}
      />

      <ElementInteractionSection
        element={element}
        onUpdate={onUpdate}
        controlPrefix="shape"
      />
    </>
  );
}
