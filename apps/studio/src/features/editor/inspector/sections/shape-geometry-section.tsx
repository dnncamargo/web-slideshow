import { useState } from "react";

import {
  ShapePathGeometrySchema,
  type PresentationFileResource,
  type ShapeElement,
} from "@web-slideshow/document-schema";

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
import {
  parseSvgPathAuthoringSource,
  serializeSvgPathData,
} from "../../svg-path-authoring";
import type { ShapeSvgImportCompositionHandler } from "../inspector-types";

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
  pathSource: string;
  pathViewBoxX: string;
  pathViewBoxY: string;
  pathViewBoxWidth: string;
  pathViewBoxHeight: string;
  pathFillRule: "nonzero" | "evenodd";
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
    pathSource: geometry.mode === "path" ? serializeSvgPathData(geometry.commands) : "",
    pathViewBoxX: geometry.mode === "path" ? String(geometry.viewBox.x) : "0",
    pathViewBoxY: geometry.mode === "path" ? String(geometry.viewBox.y) : "0",
    pathViewBoxWidth: geometry.mode === "path" ? String(geometry.viewBox.width) : "100",
    pathViewBoxHeight: geometry.mode === "path" ? String(geometry.viewBox.height) : "100",
    pathFillRule: geometry.mode === "path" ? geometry.fillRule ?? "nonzero" : "nonzero",
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
  onImportSvgComposition?: ShapeSvgImportCompositionHandler;
  presentationFiles?: readonly PresentationFileResource[];
}

export function ShapeGeometrySection({ element, onUpdate, onImportSvgComposition, presentationFiles = [] }: ShapeGeometrySectionProps) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const preset = getShapeGeometryPreset(element.geometry);
  const identity = `${element.id}:${geometryIdentity(element.geometry)}`;
  const [draftState, setDraftState] = useState<ShapeGeometryDrafts>(() => createGeometryDrafts(identity, element.geometry));
  const [pathMessage, setPathMessage] = useState<string | null>(null);
  const [selectedSvgFileId, setSelectedSvgFileId] = useState("");
  const svgFiles = presentationFiles.filter((file) => file.kind === "image" && file.representation === "text" && file.contentType === "image/svg+xml");
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
    setPathMessage(null);
    runDiscrete(presetHistoryMeta, () => onUpdate((current) => ({
      ...current,
      geometry: createShapeGeometry(nextPreset),
    })));
  }

  function applyPathDraft(source = drafts.pathSource): void {
    try {
      const imported = parseSvgPathAuthoringSource(source);
      if (imported.kind === "svg") {
        const layers = imported.layers ?? [];
        if (layers.length === 0 || imported.viewBox === undefined) {
          throw new Error(t("inspector.shape.invalidGeometry"));
        }
        if (layers.length > 1) {
          if (onImportSvgComposition === undefined) {
            throw new Error(t("inspector.shape.compoundImportUnavailable"));
          }
          const result = onImportSvgComposition({ viewBox: imported.viewBox, layers });
          if (!result.ok) {
            const message = result.reason === "compound-transform-animation"
              ? t("inspector.shape.compoundTransformAnimation")
              : result.reason === "compound-import-unavailable"
                ? t("inspector.shape.compoundImportUnavailable")
                : t("inspector.shape.compoundImportFailed");
            throw new Error(message);
          }
          setPathMessage(null);
          return;
        }
        const layer = layers[0];
        if (layer === undefined) throw new Error(t("inspector.shape.invalidGeometry"));
        const nextStyle = {
          ...(element.style?.borderRadius === undefined ? {} : { borderRadius: element.style.borderRadius }),
          ...layer.style,
        };
        const nextEffect = {
          ...(element.effect?.shadow === undefined ? {} : { shadow: element.effect.shadow }),
          ...(layer.effect?.opacity === undefined
            ? element.effect?.opacity === undefined ? {} : { opacity: element.effect.opacity }
            : { opacity: layer.effect.opacity }),
        };
        const hasStyle = Object.keys(nextStyle).length > 0;
        const hasEffect = Object.keys(nextEffect).length > 0;
        setPathMessage(null);
        runDiscrete(presetHistoryMeta, () => onUpdate((current) => current.type === "shape"
          ? {
              ...current,
              geometry: layer.geometry,
              ...(hasStyle ? { style: nextStyle } : { style: undefined }),
              ...(hasEffect ? { effect: nextEffect } : { effect: undefined }),
            }
          : current));
        return;
      }
      const viewBox = imported.viewBox ?? (() => {
        const viewBoxX = parseFiniteNumber(drafts.pathViewBoxX);
        const viewBoxY = parseFiniteNumber(drafts.pathViewBoxY);
        const viewBoxWidth = parseFiniteNumber(drafts.pathViewBoxWidth);
        const viewBoxHeight = parseFiniteNumber(drafts.pathViewBoxHeight);
        if (viewBoxX === undefined || viewBoxY === undefined || viewBoxWidth === undefined || viewBoxHeight === undefined || viewBoxWidth <= 0 || viewBoxHeight <= 0) {
          throw new Error(t("inspector.shape.invalidViewBox"));
        }
        return { x: viewBoxX, y: viewBoxY, width: viewBoxWidth, height: viewBoxHeight };
      })();
      const candidate = {
        mode: "path" as const,
        viewBox,
        commands: imported.commands,
        ...((imported.fillRule ?? drafts.pathFillRule) === "evenodd" ? { fillRule: "evenodd" as const } : {}),
      };
      const parsed = ShapePathGeometrySchema.safeParse(candidate);
      if (!parsed.success) {
        throw new Error(t("inspector.shape.invalidGeometry"));
      }
      if (geometryIdentity(parsed.data) === geometryIdentity(element.geometry)) {
        setPathMessage(null);
        return;
      }

      setPathMessage(null);
      runDiscrete(presetHistoryMeta, () => onUpdate((current) => current.type === "shape"
        ? { ...current, geometry: parsed.data }
        : current));
    } catch (error) {
      setPathMessage(error instanceof Error ? error.message : t("inspector.shape.invalidGeometry"));
    }
  }

  function importSelectedSvgFile(): void {
    const file = svgFiles.find((candidate) => candidate.id === selectedSvgFileId);
    if (file?.source.type !== "text") return;
    applyPathDraft(file.source.content);
  }

  function resetPathDraft(): void {
    setDraftState(createGeometryDrafts(identity, element.geometry));
    setPathMessage(null);
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

      {svgFiles.length > 0 && (
        <div className={styles.field}>
          <span>{t("inspector.shape.svgFile")}</span>
          <select
            id="shape-svg-file"
            name="shapeSvgFile"
            value={selectedSvgFileId}
            onChange={(event) => setSelectedSvgFileId(event.target.value)}
          >
            <option value="">{t("inspector.shape.selectSvgFile")}</option>
            {svgFiles.map((file) => <option key={file.id} value={file.id}>{file.name}</option>)}
          </select>
          <button
            id="shape-svg-file-import"
            type="button"
            className={styles.secondaryButton}
            disabled={selectedSvgFileId === ""}
            onClick={() => importSelectedSvgFile()}
          >
            {t("inspector.shape.importSvgFile")}
          </button>
        </div>
      )}

      {element.geometry.mode === "path" && (
        <>
          <label className={styles.field}>
            <span>{t("inspector.shape.pathSource")}</span>
            <textarea
              id="shape-path-source"
              name="shapePathSource"
              className={styles.textArea}
              rows={5}
              spellCheck={false}
              value={drafts.pathSource}
              onChange={(event) => {
                setDraft("pathSource", event.target.value);
                setPathMessage(null);
              }}
            />
            <small className={styles.fieldHint}>{t("inspector.shape.pathSourceHint")}</small>
          </label>
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>{t("inspector.shape.viewBoxX")}</span>
              <input id="shape-path-viewbox-x" type="number" step="1" value={drafts.pathViewBoxX} onChange={(event) => setDraft("pathViewBoxX", event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>{t("inspector.shape.viewBoxY")}</span>
              <input id="shape-path-viewbox-y" type="number" step="1" value={drafts.pathViewBoxY} onChange={(event) => setDraft("pathViewBoxY", event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>{t("inspector.shape.viewBoxWidth")}</span>
              <input id="shape-path-viewbox-width" type="number" min="0.000001" step="1" value={drafts.pathViewBoxWidth} onChange={(event) => setDraft("pathViewBoxWidth", event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>{t("inspector.shape.viewBoxHeight")}</span>
              <input id="shape-path-viewbox-height" type="number" min="0.000001" step="1" value={drafts.pathViewBoxHeight} onChange={(event) => setDraft("pathViewBoxHeight", event.target.value)} />
            </label>
          </div>
          <label className={styles.field}>
            <span>{t("inspector.shape.fillRule")}</span>
            <select id="shape-path-fill-rule" value={drafts.pathFillRule} onChange={(event) => setDraft("pathFillRule", event.target.value as "nonzero" | "evenodd")}>
              <option value="nonzero">nonzero</option>
              <option value="evenodd">evenodd</option>
            </select>
          </label>
          {pathMessage !== null ? <small className={styles.fieldHint}>{pathMessage}</small> : null}
          <div className={styles.elementCrudActions}>
            <button id="shape-path-apply" type="button" className={styles.secondaryButton} onClick={() => applyPathDraft()}>{t("inspector.shape.applyPath")}</button>
            <button id="shape-path-reset" type="button" className={styles.secondaryButton} onClick={resetPathDraft}>{t("inspector.shape.resetPath")}</button>
          </div>
        </>
      )}

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
              type="number"
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
            type="number"
            min="0"
            max="100"
            step="1"
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
              type="number"
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
                type="number"
                min="1"
                max="100"
                step="1"
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
              type="number"
              step="1"
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
