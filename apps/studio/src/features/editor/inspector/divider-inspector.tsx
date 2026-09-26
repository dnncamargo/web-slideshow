import type {
  DividerElement,
} from "@web-slideshow/document-schema";
import type { Presentation } from "@web-slideshow/document-schema";

import type {
  AuthoringLengthUnit,
} from "@web-slideshow/theme/element-style-defaults";
import { resolveEffectiveElementStyleDefaults } from "@web-slideshow/theme/element-style-defaults";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import { InspectorSection } from "./inspector-section";

import type {
  TypedInspectorProps,
} from "./inspector-types";
import { ColorControl } from "./sections/color-control";
import { parseOptionalNumber } from "./inspector-helpers";
import { ElementGradientControl } from "./sections/element-gradient-control";

import { EffectiveLengthInput } from "./sections/effective-length-input";
import { useAuthoringHistory } from "../authoring-history-context";
import { TargetLinkedStyleSection } from "./sections/target-linked-style-section";
import { inspectTargetLinkedStyle } from "./linked-style-inspector";

type DividerOrientation = DividerElement["orientation"];

type DividerBackgroundKey = "color" | "gradient";

function updateDividerBackground(
  style: DividerElement["style"] | undefined,
  key: DividerBackgroundKey,
  value: NonNullable<NonNullable<DividerElement["style"]>["background"]>[DividerBackgroundKey] | undefined,
): DividerElement["style"] {
  const background = { ...style?.background, [key]: value };
  if (background.color === undefined && background.gradient === undefined) {
    return { ...style, background: undefined };
  }
  return { ...style, background };
}

interface DividerGeometryDefault {
  value: number;

  unit: AuthoringLengthUnit;
}

interface DividerGeometry {
  width: DividerGeometryDefault;

  height: DividerGeometryDefault;
}

// ============================================================
// BEGIN: DIVIDER EFFECTIVE GEOMETRY DEFAULTS
//
// These match the renderer defaults. They are displayed when
// the canonical style dimensions are undefined and are not
// persisted until the user edits the field.
// ============================================================

const DIVIDER_GEOMETRY_DEFAULTS: Readonly<
  Record<DividerOrientation, Readonly<DividerGeometry>>
> = {
  horizontal: {
    width: { value: 100, unit: "%" },

    height: { value: 2, unit: "px" },
  },

  vertical: {
    width: { value: 2, unit: "px" },

    height: { value: 100, unit: "%" },
  },
};

// ============================================================
// END: DIVIDER EFFECTIVE GEOMETRY DEFAULTS
// ============================================================

// ============================================================
// BEGIN: DIVIDER INSPECTOR
// ============================================================

export function DividerInspector({
  element,
  onUpdate,
  presentation,
  onAttachLinkedStyle,
  onDetachLinkedStyle,
}: TypedInspectorProps<DividerElement> & { presentation?: Presentation; onAttachLinkedStyle?: (id: string) => void; onDetachLinkedStyle?: () => void }) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const runDiscrete = (callback: () => void): void => {
    const meta = { kind: "element.setting", labelKey: "history.element.setting", labelParams: { setting: "divider.orientation" } } as const;
    if (authoringHistory) authoringHistory.discrete(meta, callback);
    else callback();
  };

  const updateLayout = (update: (layout: DividerElement["layout"] | undefined) => DividerElement["layout"] | undefined) => {
    onUpdate((current) => {
      if (current.type !== "divider") {
        return current;
      }

      return {
        ...current,

        layout: update(current.layout),
      };
    });
  };
  const updateStyle = (update: (style: DividerElement["style"] | undefined) => DividerElement["style"] | undefined) => {
    onUpdate((current) => current.type === "divider" ? { ...current, style: update(current.style) } : current);
  };
  const updateEffect = (update: (effect: DividerElement["effect"] | undefined) => DividerElement["effect"] | undefined) => {
    onUpdate((current) => current.type === "divider" ? { ...current, effect: update(current.effect) } : current);
  };

  const geometry =
    DIVIDER_GEOMETRY_DEFAULTS[element.orientation];
  const linkedInspection = inspectTargetLinkedStyle(presentation, element);
  const resolved = linkedInspection.resolved as { layout?: DividerElement["layout"]; style?: DividerElement["style"]; effect?: DividerElement["effect"] } | undefined;
  const property = linkedInspection.getProperty;
  const widthOwned = property("layout.width").owned;
  const heightOwned = property("layout.height").owned;
  const backgroundColorOwned = property("style.background.color").owned;
  const gradientOwned = property("style.background.gradient").owned;
  const radiusOwned = property("style.borderRadius").owned;
  const opacityOwned = property("effect.opacity").owned;

  return (
    <>
      <div className={styles.inspectorDivider} />

      {presentation && onAttachLinkedStyle && onDetachLinkedStyle ? <TargetLinkedStyleSection element={element} presentation={presentation} onAttach={onAttachLinkedStyle} onDetach={onDetachLinkedStyle} /> : null}

      <InspectorSection title={t("inspector.layout")} defaultOpen>
        <label className={styles.field}>
          <span>{t("inspector.direction")}</span>

          <select
            id="divider-orientation"
            name="dividerOrientation"
            value={element.orientation}
            onChange={(event) => {
              const orientation =
                event.target.value as DividerOrientation;
              if (orientation === element.orientation) return;
              runDiscrete(() => onUpdate((current) => {
                if (current.type !== "divider") {
                  return current;
                }

                if (widthOwned || heightOwned) {
                  return { ...current, orientation };
                }

                const width = current.layout?.width;

                const height = current.layout?.height;

                if (width === undefined && height === undefined) {
                  return { ...current, orientation };
                }

                return {
                  ...current,

                  orientation,

                  layout: {
                    ...current.layout,

                    width: height,

                    height: width,
                  },
                };
              }));
            }}
          >
            <option value="horizontal">
              {t("inspector.horizontal")}
            </option>

            <option value="vertical">
              {t("inspector.vertical")}
            </option>
          </select>
        </label>
      </InspectorSection>

      <InspectorSection title={t("inspector.size")}>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>{t("inspector.width")}</span>

            <EffectiveLengthInput
              id="divider-width"
              name="dividerWidth"
              value={element.layout?.width}
              inheritedValue={resolved?.layout?.width ?? geometry.width.value}
              preferredUnit={geometry.width.unit}
              units={["px", "%"]}
              min="0"
              stepByUnit={{ px: "1", "%": "1" }}
              disabled={widthOwned}
              onChange={(width) => {
                updateLayout((currentStyle) => ({
                  ...currentStyle,

                  width,
                }));
              }}
              onReset={() => {
                updateLayout((currentStyle) => ({
                  ...currentStyle,

                  width: undefined,
                }));
              }}
            />
          </label>

          <label className={styles.field}>
            <span>{t("inspector.height")}</span>

            <EffectiveLengthInput
              id="divider-height"
              name="dividerHeight"
              value={element.layout?.height}
              inheritedValue={resolved?.layout?.height ?? geometry.height.value}
              preferredUnit={geometry.height.unit}
              units={["px", "%"]}
              min="0"
              stepByUnit={{ px: "1", "%": "1" }}
              disabled={heightOwned}
              onChange={(height) => {
                updateLayout((currentStyle) => ({
                  ...currentStyle,

                  height,
                }));
              }}
              onReset={() => {
                updateLayout((currentStyle) => ({
                  ...currentStyle,

                  height: undefined,
                }));
              }}
            />
          </label>
        </div>
      </InspectorSection>

      <InspectorSection title={t("inspector.appearance")}>
        <div className={styles.colorControl}>
          <label className={styles.field}>
            <span title={t("inspector.backgroundHelp")}>{t("inspector.background")}</span>
            <ColorControl
              id="divider-background"
              name="dividerBackground"
              value={resolved?.style?.background?.color}
              disabled={backgroundColorOwned}
              onChange={(color) => { if (!backgroundColorOwned) updateStyle((current) => updateDividerBackground(current, "color", color)); }}
              secondaryAction={backgroundColorOwned ? undefined : {
                label: t("inspector.remove"),
                onClick: () => updateStyle((current) => updateDividerBackground(current, "color", undefined)),
              }}
            />
          </label>
        </div>
        <ElementGradientControl
          gradient={resolved?.style?.background?.gradient}
          disabled={gradientOwned}
          controlPrefix="divider-background"
          onChange={(gradient) => { if (!gradientOwned) updateStyle((current) => updateDividerBackground(current, "gradient", gradient)); }}
        />
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <label
              htmlFor="divider-border-radius"
              title={t("inspector.roundedCornersHelp")}
            >
              {t("inspector.roundedCorners")}
            </label>
            <EffectiveLengthInput
              id="divider-border-radius"
              name="dividerBorderRadius"
              min="0"
              value={resolved?.style?.borderRadius}
              inheritedValue={resolved?.style?.borderRadius ?? resolveEffectiveElementStyleDefaults(element).borderRadius}
              preferredUnit="px"
              units={["px", "rem"]}
              stepByUnit={{ px: "1", rem: "0.1" }}
              disabled={radiusOwned}
              onChange={(borderRadius) => updateStyle((current) => ({
                ...current,
                borderRadius,
              }))}
              onReset={() => updateStyle((current) => ({
                ...current,
                borderRadius: undefined,
              }))}
            />
          </div>
          <label className={styles.field}>
            <span title={t("inspector.opacityHelp")}>{t("inspector.opacity")}</span>
            <div className={styles.unitInput}>
              <input
                id="divider-opacity"
                name="dividerOpacity"
                type="number"
                min="0"
                max="100"
                value={(resolved?.effect?.opacity ?? 1) * 100}
                disabled={opacityOwned}
                onChange={(event) => {
                  if (opacityOwned) return;
                  const value = parseOptionalNumber(event.target.value);
                  updateEffect((current) => ({
                    ...current,
                    opacity: value === undefined ? undefined : value / 100,
                  }));
                }}
              />
              <span>%</span>
            </div>
          </label>
        </div>
      </InspectorSection>
    </>
  );
}

// ============================================================
// END: DIVIDER INSPECTOR
// ============================================================
