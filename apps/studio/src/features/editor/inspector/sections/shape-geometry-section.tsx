import { useState } from "react";

import type { ShapeElement } from "@web-slideshow/document-schema";

import { useAuthoringHistory } from "../../authoring-history-context";
import type { HistoryActionMeta } from "../../editor-history-state";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import { InspectorSection } from "../inspector-section";
import {
  createShapeGeometry,
  getShapeGeometryPreset,
  SHAPE_AUTHORING_PRESETS,
  type ShapePreset,
} from "../../shape-geometry-authoring";

const numberChangeHistoryMeta = {
  kind: "number.change",
  labelKey: "history.number.change",
} as const;

const presetHistoryMeta = {
  kind: "element.setting",
  labelKey: "history.element.setting",
  labelParams: { setting: "shape.geometry" },
} as const;

const qrContentHistoryMeta = {
  kind: "text.edit",
  labelKey: "history.text.edit",
} as const;

const qrCorrectionHistoryMeta = {
  kind: "element.setting",
  labelKey: "history.element.setting",
  labelParams: { setting: "shape.qr.errorCorrection" },
} as const;

const qrQuietZoneHistoryMeta = {
  kind: "number.change",
  labelKey: "history.number.change",
} as const;

function geometryIdentity(geometry: ShapeElement["geometry"]): string {
  return JSON.stringify(geometry);
}

function parseFiniteNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

interface ShapeGeometryDrafts {
  identity: string;
  apex: string;
  points: string;
  innerRadius: string;
  rotation: string;
  qrContent: string;
  qrErrorCorrection: "L" | "M" | "Q" | "H";
  qrQuietZone: string;
}

function createGeometryDrafts(
  identity: string,
  geometry: ShapeElement["geometry"],
): ShapeGeometryDrafts {
  return {
    identity,
    apex: geometry.mode === "generated" && geometry.generator === "triangle"
      ? String(geometry.config.apexX)
      : "",
    points: geometry.mode === "generated" && geometry.generator === "polygon"
      ? String(geometry.config.points)
      : "",
    innerRadius: geometry.mode === "generated" && geometry.generator === "polygon"
      ? String((geometry.config.innerRadius ?? 1) * 100)
      : "",
    rotation: geometry.mode === "generated" && geometry.generator === "polygon"
      ? String(geometry.config.rotationDeg ?? 0)
      : "",
    qrContent: geometry.mode === "generated" && geometry.generator === "qr-code"
      ? geometry.config.value
      : "",
    qrErrorCorrection: geometry.mode === "generated" && geometry.generator === "qr-code"
      ? geometry.config.errorCorrection
      : "M",
    qrQuietZone: geometry.mode === "generated" && geometry.generator === "qr-code"
      ? String(geometry.config.quietZone)
      : "",
  };
}

function presetLabel(
  preset: Exclude<ShapePreset, "custom" | "qr-code">,
  t: ReturnType<typeof useStudioI18n>["t"],
): string {
  return t(`inspector.shape.${preset}`);
}

interface ShapeGeometrySectionProps {
  element: ShapeElement;
  onUpdate: (update: (element: ShapeElement) => ShapeElement) => void;
}

export function ShapeGeometrySection({ element, onUpdate }: ShapeGeometrySectionProps) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const preset = getShapeGeometryPreset(element.geometry);
  const identity = `${element.id}:${geometryIdentity(element.geometry)}`;
  const [draftState, setDraftState] = useState<ShapeGeometryDrafts>(() => createGeometryDrafts(identity, element.geometry));
  const drafts = draftState.identity === identity
    ? draftState
    : createGeometryDrafts(identity, element.geometry);

  function setDraft<K extends keyof Omit<ShapeGeometryDrafts, "identity">>(field: K, value: ShapeGeometryDrafts[K]): void {
    setDraftState({ ...drafts, [field]: value });
  }

  function runDiscrete(meta: HistoryActionMeta, callback: () => void): void {
    if (authoringHistory) authoringHistory.discrete(meta, callback);
    else callback();
  }

  function updateQrConfig(
    update: (config: Extract<ShapeElement["geometry"], { mode: "generated"; generator: "qr-code" }>["config"]) => Extract<ShapeElement["geometry"], { mode: "generated"; generator: "qr-code" }>["config"],
  ): void {
    if (element.geometry.mode !== "generated" || element.geometry.generator !== "qr-code") return;
    onUpdate((current) => {
      if (current.geometry.mode !== "generated" || current.geometry.generator !== "qr-code") return current;
      return { ...current, geometry: { ...current.geometry, config: update(current.geometry.config) } };
    });
  }

  function updateQrContent(value: string): void {
    if (value.length === 0) return;
    if (authoringHistory) {
      authoringHistory.update(`text:shape:${element.id}:qr-content`, () => updateQrConfig((config) => ({ ...config, value })));
    } else {
      updateQrConfig((config) => ({ ...config, value }));
    }
    setDraftState((current) => ({ ...current, identity: "" }));
  }

  function updateQrErrorCorrection(value: string): void {
    if (value !== "L" && value !== "M" && value !== "Q" && value !== "H") return;
    if (element.geometry.mode !== "generated" || element.geometry.generator !== "qr-code" || element.geometry.config.errorCorrection === value) return;
    runDiscrete(qrCorrectionHistoryMeta, () => updateQrConfig((config) => ({ ...config, errorCorrection: value })));
  }

  function parseQrQuietZone(value: string): number | undefined {
    if (value.trim() === "") return undefined;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
  }

  function updateQrQuietZone(value: string): void {
    const parsed = parseQrQuietZone(value);
    if (parsed === undefined) return;
    if (element.geometry.mode !== "generated" || element.geometry.generator !== "qr-code" || element.geometry.config.quietZone === parsed) return;
    if (authoringHistory) {
      authoringHistory.update(`number:shape:${element.id}:qr-quiet-zone`, () => updateQrConfig((config) => ({ ...config, quietZone: parsed })));
    } else {
      updateQrConfig((config) => ({ ...config, quietZone: parsed }));
    }
    setDraftState((current) => ({ ...current, identity: "" }));
  }

  function replaceGeometry(nextPreset: Exclude<ShapePreset, "custom" | "qr-code">): void {
    if (preset === nextPreset) return;
    runDiscrete(presetHistoryMeta, () => onUpdate((current) => ({
      ...current,
      geometry: createShapeGeometry(nextPreset),
    })));
  }

  function updateTriangle(value: string): void {
    const parsed = parseFiniteNumber(value);
    if (parsed === undefined || parsed < 0 || parsed > 100) {
      setDraft("apex", String(element.geometry.mode === "generated" && element.geometry.generator === "triangle" ? element.geometry.config.apexX : 50));
      return;
    }

    if (element.geometry.mode !== "generated" || element.geometry.generator !== "triangle" || element.geometry.config.apexX === parsed) return;
    runDiscrete(numberChangeHistoryMeta, () => onUpdate((current) => {
      if (current.geometry.mode !== "generated" || current.geometry.generator !== "triangle") return current;
      return { ...current, geometry: { ...current.geometry, config: { ...current.geometry.config, apexX: parsed } } };
    }));
  }

  function updatePolygonConfig(update: (config: Extract<ShapeElement["geometry"], { mode: "generated"; generator: "polygon" }>['config']) => Extract<ShapeElement["geometry"], { mode: "generated"; generator: "polygon" }>['config']): void {
    if (element.geometry.mode !== "generated" || element.geometry.generator !== "polygon") return;
    runDiscrete(numberChangeHistoryMeta, () => onUpdate((current) => {
      if (current.geometry.mode !== "generated" || current.geometry.generator !== "polygon") return current;
      return { ...current, geometry: { ...current.geometry, config: update(current.geometry.config) } };
    }));
  }

  function commitPoints(value: string): void {
    const parsed = parseFiniteNumber(value);
    if (parsed === undefined || !Number.isInteger(parsed) || parsed < 3 || parsed > 12) {
      setDraft("points", String(element.geometry.mode === "generated" && element.geometry.generator === "polygon" ? element.geometry.config.points : 5));
      return;
    }
    if (element.geometry.mode === "generated" && element.geometry.generator === "polygon" && element.geometry.config.points !== parsed) {
      updatePolygonConfig((config) => ({ ...config, points: parsed }));
    }
  }

  function commitInnerRadius(value: string): void {
    const parsed = parseFiniteNumber(value);
    if (parsed === undefined || parsed < 1 || parsed > 100) {
      setDraft("innerRadius", String((element.geometry.mode === "generated" && element.geometry.generator === "polygon" ? element.geometry.config.innerRadius ?? 1 : 1) * 100));
      return;
    }
    const canonical = parsed / 100;
    if (element.geometry.mode === "generated" && element.geometry.generator === "polygon" && element.geometry.config.innerRadius !== canonical) {
      updatePolygonConfig((config) => ({ ...config, innerRadius: canonical }));
    }
  }

  function commitRotation(value: string): void {
    const parsed = parseFiniteNumber(value);
    if (parsed === undefined) {
      setDraft("rotation", String(element.geometry.mode === "generated" && element.geometry.generator === "polygon" ? element.geometry.config.rotationDeg ?? 0 : 0));
      return;
    }
    if (element.geometry.mode === "generated" && element.geometry.generator === "polygon" && element.geometry.config.rotationDeg !== parsed) {
      updatePolygonConfig((config) => ({ ...config, rotationDeg: parsed }));
    }
  }

  return (
    <InspectorSection title={t("inspector.shape.geometry")} defaultOpen>
      <label className={styles.field}>
        <span>{t("inspector.shape.preset")}</span>
        <select
          id="shape-geometry-preset"
          name="shapeGeometryPreset"
          value={preset}
          onChange={(event) => {
            const nextPreset = event.target.value as ShapePreset;
            if (SHAPE_AUTHORING_PRESETS.includes(nextPreset as Exclude<ShapePreset, "custom" | "qr-code">)) {
              replaceGeometry(nextPreset as Exclude<ShapePreset, "custom" | "qr-code">);
            }
          }}
          disabled={preset === "qr-code"}
        >
          {preset === "custom" && <option value="custom">{t("inspector.shape.customPath")}</option>}
          {preset === "qr-code" && <option value="qr-code">{t("inspector.shape.qrCode")}</option>}
          {SHAPE_AUTHORING_PRESETS.map((option) => (
            <option key={option} value={option}>{presetLabel(option, t)}</option>
          ))}
        </select>
      </label>

      {element.geometry.mode === "generated" && element.geometry.generator === "qr-code" && (
        <>
          <label className={styles.field}>
            <span>{t("inspector.shape.qrContent")}</span>
            <input
              id="shape-qr-content"
              name="shapeQrContent"
              type="text"
              value={drafts.qrContent}
              onFocus={() => authoringHistory?.begin(`text:shape:${element.id}:qr-content`, qrContentHistoryMeta)}
              onChange={(event) => {
                setDraft("qrContent", event.target.value);
                updateQrContent(event.target.value);
              }}
              onBlur={() => {
                if (drafts.qrContent.length === 0) {
                  setDraft("qrContent", element.geometry.mode === "generated" && element.geometry.generator === "qr-code" ? element.geometry.config.value : "");
                }
                authoringHistory?.finish(`text:shape:${element.id}:qr-content`);
              }}
            />
          </label>
          <label className={styles.field}>
            <span>{t("inspector.shape.qrErrorCorrection")}</span>
            <select
              id="shape-qr-error-correction"
              name="shapeQrErrorCorrection"
              value={drafts.qrErrorCorrection}
              onChange={(event) => updateQrErrorCorrection(event.target.value)}
            >
              <option value="L">L</option>
              <option value="M">M</option>
              <option value="Q">Q</option>
              <option value="H">H</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>{t("inspector.shape.qrQuietZone")}</span>
            <input
              id="shape-qr-quiet-zone"
              name="shapeQrQuietZone"
              type="text"
              inputMode="numeric"
              min="0"
              step="1"
              value={drafts.qrQuietZone}
              onFocus={() => authoringHistory?.begin(`number:shape:${element.id}:qr-quiet-zone`, qrQuietZoneHistoryMeta)}
              onChange={(event) => {
                setDraft("qrQuietZone", event.target.value);
                updateQrQuietZone(event.target.value);
              }}
              onBlur={() => {
                if (parseQrQuietZone(drafts.qrQuietZone) === undefined) {
                  setDraft("qrQuietZone", element.geometry.mode === "generated" && element.geometry.generator === "qr-code" ? String(element.geometry.config.quietZone) : "");
                }
                authoringHistory?.finish(`number:shape:${element.id}:qr-quiet-zone`);
              }}
            />
          </label>
        </>
      )}

      {element.geometry.mode === "generated" && element.geometry.generator === "triangle" && (
        <label className={styles.field}>
          <span>{t("inspector.shape.apexPosition")}</span>
          <input
            id="shape-apex-x"
            name="shapeApexX"
            type="text"
            inputMode="decimal"
            min="0"
            max="100"
            value={drafts.apex}
            onChange={(event) => setDraft("apex", event.target.value)}
            onBlur={(event) => updateTriangle(event.currentTarget.value)}
          />
        </label>
      )}

      {element.geometry.mode === "generated" && element.geometry.generator === "polygon" && (
        <>
          <label className={styles.field}>
            <span>{t("inspector.shape.points")}</span>
            <input
              id="shape-polygon-points"
              name="shapePolygonPoints"
              type="text"
              inputMode="numeric"
              min="3"
              max="12"
              step="1"
              value={drafts.points}
              onChange={(event) => setDraft("points", event.target.value)}
              onBlur={(event) => commitPoints(event.currentTarget.value)}
            />
          </label>
          <label className={styles.field}>
            <span>{t("inspector.shape.innerRadius")}</span>
            <div className={styles.unitInput}>
              <input
                id="shape-polygon-inner-radius"
                name="shapePolygonInnerRadius"
                type="text"
                inputMode="decimal"
                min="1"
                max="100"
                value={drafts.innerRadius}
                onChange={(event) => setDraft("innerRadius", event.target.value)}
                onBlur={(event) => commitInnerRadius(event.currentTarget.value)}
              />
              <span>%</span>
            </div>
          </label>
          <label className={styles.field}>
            <span>{t("inspector.shape.rotation")}</span>
            <input
              id="shape-polygon-rotation"
              name="shapePolygonRotation"
              type="text"
              inputMode="decimal"
              value={drafts.rotation}
              onChange={(event) => setDraft("rotation", event.target.value)}
              onBlur={(event) => commitRotation(event.currentTarget.value)}
            />
          </label>
        </>
      )}
    </InspectorSection>
  );
}
