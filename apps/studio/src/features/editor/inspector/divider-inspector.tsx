import type {
  DividerElement,
} from "@powershow/document-schema";

import type {
  AuthoringLengthUnit,
} from "@powershow/theme/element-style-defaults";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import { InspectorSection } from "./inspector-section";

import type {
  TypedInspectorProps,
  UpdateElementStyle,
} from "./inspector-types";

import { ElementAppearanceSection } from "./sections/element-appearance-section";

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

  const updateStyle: UpdateElementStyle = (update) => {
    onUpdate((current) => {
      if (current.type !== "divider") {
        return current;
      }

      return {
        ...current,

        style: update(current.style),
      };
    });
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

                const width = current.style?.width;

                const height = current.style?.height;

                if (width === undefined && height === undefined) {
                  return { ...current, orientation };
                }

                return {
                  ...current,

                  orientation,

                  style: {
                    ...current.style,

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
              value={element.style?.width}
              inheritedValue={geometry.width.value}
              preferredUnit={geometry.width.unit}
              units={["px", "%"]}
              min="0"
              stepByUnit={{ px: "1", "%": "1" }}
              onChange={(width) => {
                updateStyle((currentStyle) => ({
                  ...currentStyle,

                  width,
                }));
              }}
              onReset={() => {
                updateStyle((currentStyle) => ({
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
              value={element.style?.height}
              inheritedValue={geometry.height.value}
              preferredUnit={geometry.height.unit}
              units={["px", "%"]}
              min="0"
              stepByUnit={{ px: "1", "%": "1" }}
              onChange={(height) => {
                updateStyle((currentStyle) => ({
                  ...currentStyle,

                  height,
                }));
              }}
              onReset={() => {
                updateStyle((currentStyle) => ({
                  ...currentStyle,

                  height: undefined,
                }));
              }}
            />
          </label>
        </div>
      </InspectorSection>

      <ElementAppearanceSection
        element={element}
        onUpdateStyle={updateStyle}
        controlPrefix="divider"
        showBackground
        showOpacity
        showRoundedCorners
      />
    </>
  );
}

// ============================================================
// END: DIVIDER INSPECTOR
// ============================================================