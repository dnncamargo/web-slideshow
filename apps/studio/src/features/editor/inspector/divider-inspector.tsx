import type {
  DividerElement,
} from "@powershow/document-schema";

import type {
  AuthoringLengthUnit,
} from "@powershow/theme/element-style-defaults";
import { resolveEffectiveElementStyleDefaults } from "@powershow/theme/element-style-defaults";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import { InspectorSection } from "./inspector-section";

import type {
  TypedInspectorProps,
} from "./inspector-types";
import { ColorControl } from "./sections/color-control";
import { parseOptionalNumber } from "./inspector-helpers";

import { EffectiveLengthInput } from "./sections/effective-length-input";

type DividerOrientation = DividerElement["orientation"];

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
}: TypedInspectorProps<DividerElement>) {
  const { t } = useStudioI18n();

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

  return (
    <>
      <div className={styles.inspectorDivider} />

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

              onUpdate((current) => {
                if (current.type !== "divider") {
                  return current;
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
              });
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
              inheritedValue={geometry.width.value}
              preferredUnit={geometry.width.unit}
              units={["px", "%"]}
              min="0"
              stepByUnit={{ px: "1", "%": "1" }}
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
              inheritedValue={geometry.height.value}
              preferredUnit={geometry.height.unit}
              units={["px", "%"]}
              min="0"
              stepByUnit={{ px: "1", "%": "1" }}
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
              value={element.style?.background?.color}
              onChange={(color) => updateStyle((current) => ({
                ...current,
                background: { color },
              }))}
              secondaryAction={{ label: t("inspector.remove"), onClick: () => updateStyle((current) => ({ ...current, background: undefined })) }}
            />
          </label>
        </div>
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
              value={element.style?.borderRadius}
              inheritedValue={resolveEffectiveElementStyleDefaults(element).borderRadius}
              preferredUnit="px"
              units={["px", "rem"]}
              stepByUnit={{ px: "1", rem: "0.1" }}
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
                value={(element.effect?.opacity ?? 1) * 100}
                onChange={(event) => {
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
