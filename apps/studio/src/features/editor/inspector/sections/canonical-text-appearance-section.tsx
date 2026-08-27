import type {
  ElementTypography,
  FontResource,
  TextElement,
  TextVisualStyle,
} from "@powershow/document-schema";
import { resolveEffectiveElementStyleDefaults } from "@powershow/theme/element-style-defaults";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import { getControlName, parseOptionalNumber } from "../inspector-helpers";
import type {
  UpdateElementEffect,
  UpdateElementTypography,
  UpdateElementVisualStyle,
} from "../inspector-types";
import { InspectorSection } from "../inspector-section";
import { ColorControl } from "./color-control";
import { ElementBorderControl } from "./element-border-control";
import { ElementGradientControl } from "./element-gradient-control";
import { EffectiveLengthInput } from "./effective-length-input";
import { ElementTypographyControl } from "./element-typography-control";

type CanonicalTextElement = TextElement;

interface CanonicalTextAppearanceSectionProps {
  element: CanonicalTextElement;
  style: TextVisualStyle | undefined;
  typography: ElementTypography | undefined;
  effect: { opacity?: number } | undefined;
  onUpdateStyle: UpdateElementVisualStyle;
  onUpdateTypography: UpdateElementTypography;
  onUpdateEffect: UpdateElementEffect;
  controlPrefix: string;
  fontResources: readonly FontResource[];
}

function readOpacityPercentage(value: number | undefined): number {
  return value === undefined ? 100 : value * 100;
}

export function CanonicalTextAppearanceSection({
  element,
  style,
  typography,
  effect,
  onUpdateStyle,
  onUpdateTypography,
  onUpdateEffect,
  controlPrefix,
  fontResources,
}: CanonicalTextAppearanceSectionProps) {
  const { t } = useStudioI18n();
  const defaults = resolveEffectiveElementStyleDefaults(element);

  return (
    <InspectorSection title={t("inspector.appearance")}>
      {defaults.typography && (
        <ElementTypographyControl
          typography={typography}
          effectiveDefaults={defaults.typography}
          onUpdateTypography={onUpdateTypography}
          controlPrefix={controlPrefix}
          fontResources={fontResources}
        />
      )}

      <div className={styles.colorControl}>
        <label className={styles.field}>
          <span>{t("inspector.color")}</span>
          <ColorControl
            id={`${controlPrefix}-color`}
            name={getControlName(controlPrefix, "Color")}
            value={style?.color}
            onChange={(color) =>
              onUpdateStyle((current) => ({ ...current, color }))
            }
            secondaryAction={{
              label: t("inspector.useThemeDefault"),
              onClick: () => onUpdateStyle((current) => ({ ...current, color: undefined })),
            }}
          />
        </label>
      </div>

      <div className={styles.backgroundControls}>
        <div className={styles.colorControl}>
          <label className={styles.field}>
            <span title={t("inspector.backgroundHelp")}>{t("inspector.background")}</span>
            <ColorControl
              id={`${controlPrefix}-background`}
              name={getControlName(controlPrefix, "Background")}
              value={style?.background?.color}
              onChange={(color) =>
                onUpdateStyle((current) => ({
                  ...current,
                  background: { ...current?.background, color },
                }))
              }
              secondaryAction={{
                label: t("inspector.remove"),
                onClick: () => onUpdateStyle((current) => ({
                  ...current,
                  background: current?.background?.gradient
                    ? { gradient: current.background.gradient }
                    : undefined,
                })),
              }}
            />
          </label>
        </div>
        <ElementGradientControl
          gradient={style?.background?.gradient}
          controlPrefix={`${controlPrefix}-background`}
          onChange={(gradient) =>
            onUpdateStyle((current) => ({
              ...current,
                background:
                  gradient === undefined
                  ? current?.background?.color
                    ? { color: current.background.color }
                    : undefined
                  : { ...current?.background, gradient },
            }))
          }
        />
      </div>

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label htmlFor={`${controlPrefix}-border-radius`}>
            {t("inspector.roundedCorners")}
          </label>
          <EffectiveLengthInput
            id={`${controlPrefix}-border-radius`}
            name={getControlName(controlPrefix, "BorderRadius")}
            min="0"
            value={style?.borderRadius}
            inheritedValue={defaults.borderRadius}
            preferredUnit="px"
            units={["px", "rem"]}
            stepByUnit={{ px: "1", rem: "0.1" }}
            onChange={(borderRadius) =>
              onUpdateStyle((current) => ({ ...current, borderRadius }))
            }
            onReset={() =>
              onUpdateStyle((current) => ({ ...current, borderRadius: undefined }))
            }
          />
        </div>
        <label className={styles.field}>
          <span title={t("inspector.opacityHelp")}>{t("inspector.opacity")}</span>
          <div className={styles.unitInput}>
            <input
              id={`${controlPrefix}-opacity`}
              name={getControlName(controlPrefix, "Opacity")}
              type="number"
              min="0"
              max="100"
              value={readOpacityPercentage(effect?.opacity)}
              onChange={(event) => {
                const percentage = parseOptionalNumber(event.target.value);
                onUpdateEffect((current) => ({
                  ...current,
                  opacity: percentage === undefined ? undefined : percentage / 100,
                }));
              }}
            />
            <span>%</span>
          </div>
        </label>
      </div>

      <ElementBorderControl
        border={style?.border}
        onChange={(border) => onUpdateStyle((current) => ({ ...current, border }))}
        controlPrefix={controlPrefix}
      />
    </InspectorSection>
  );
}
