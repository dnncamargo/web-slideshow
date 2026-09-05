import {
  type ContainerElement,
  type PowerShowElement,
  type TextElement,
  type ElementEffect,
  type ElementTypography,
  type TextVisualStyle,
  stripLocalTextStyleProperties,
} from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import {
  convertAuthoringLength,
  resolveEffectiveElementStyleDefaults,
} from "@powershow/theme/element-style-defaults";

import styles from "../editor-workspace.module.css";

import { RichTextAuthoringControl } from "./rich-text-authoring-control";

import { InspectorSection } from "./inspector-section";

import type {
  TypographyInspectorProps,
} from "./inspector-types";

import { CanonicalTextAppearanceSection } from "./sections/canonical-text-appearance-section";

import { ElementInteractionSection } from "./sections/element-interaction-section";

import {
  shouldShowElementPositioning,
  type ElementLayerControls,
} from "./sections/element-positioning-helpers";

import { CanonicalTextPositionSection } from "./sections/canonical-text-position-section";

import { CanonicalTextEffectsSection } from "./sections/canonical-text-effects-section";

import { ElementTypographyFields } from "./sections/element-typography-control";
import {
  detachTextStyle,
  resolveEffectiveTextStyleForAuthoring,
} from "../text-typography-authoring";
import { listPresentationTextStyles } from "../text-style-helpers";

type TextInspectorElement = Extract<PowerShowElement, { type: "text" }>;

// ============================================================
// BEGIN: TEXT INSPECTOR
// ============================================================

export function TextInspector({
  element,
  onUpdate,
  fontResources,
  presentation,
  parent = null,
  layerControls = null,
}: TypographyInspectorProps<TextInspectorElement> & {
  parent?: ContainerElement | null;
  layerControls?: ElementLayerControls | null;
}) {
  const { t } = useStudioI18n();

  const updateStyle = (update: (style: TextVisualStyle | undefined) => TextVisualStyle) => {
    onUpdate((current) => {
      if (current.type !== "text") {
        return current;
      }

      return {
        ...current,

        style: update(current.style),
      };
    });
  };

  const updateTypography = (update: (value: ElementTypography | undefined) => ElementTypography) => {
    onUpdate((current) => current.type === "text" ? { ...current, typography: update(current.typography) } : current);
  };

  const updateEffect = (update: (value: ElementEffect | undefined) => ElementEffect) => {
    onUpdate((current) => current.type === "text" ? { ...current, effect: update(current.effect) } : current);
  };

  const effectiveTypography = presentation
    ? resolveEffectiveTextStyleForAuthoring(presentation, element).typography
    : undefined;
  const themeTypographyDefaults = resolveEffectiveElementStyleDefaults(element).typography;
  const typographyDefaults = effectiveTypography
    ? {
        ...effectiveTypography,
        fontSize: convertAuthoringLength(effectiveTypography.fontSize ?? themeTypographyDefaults?.fontSize ?? 18, "px") ?? themeTypographyDefaults?.fontSize ?? 18,
        lineHeight: typeof effectiveTypography.lineHeight === "number" ? effectiveTypography.lineHeight : themeTypographyDefaults?.lineHeight ?? 1.5,
        letterSpacing: convertAuthoringLength(effectiveTypography.letterSpacing ?? themeTypographyDefaults?.letterSpacing ?? 0, "px") ?? themeTypographyDefaults?.letterSpacing ?? 0,
      }
    : themeTypographyDefaults;
  const styleOptions = listPresentationTextStyles(presentation ?? { textStyles: [] });
  const fundamentalLabels: Record<string, string> = {
    title: t("inspector.titleField"),
    subtitle: t("inspector.subtitle"),
    body: t("inspector.body"),
    caption: t("inspector.caption"),
  };
  const selectedStyle = styleOptions.find(({ id }) => id === element.variant)?.style;
  const selectedStyleName = selectedStyle && "name" in selectedStyle
    ? selectedStyle.name
    : fundamentalLabels[element.variant] ?? element.variant;

  function attachTextStyle(variant: TextInspectorElement["variant"]) {
    onUpdate((current) => {
      if (current.type !== "text") return current;
      const { styleDetached: _detached, typography: _ownedTypography, style: _ownedStyle, ...attached } = current;
      const local = stripLocalTextStyleProperties(current.typography, current.style);
      return {
        ...attached,
        variant,
        ...(local.style === undefined ? {} : { style: local.style }),
        ...(local.typography === undefined ? {} : { typography: local.typography }),
      };
    });
  }

  return (
    <>
      <div className={styles.inspectorDivider} />

      <InspectorSection title={t("inspector.content")} defaultOpen>
        <RichTextAuthoringControl
          content={element.content}
          onChange={(content) => onUpdate((current) => current.type === "text" ? { ...current, content } : current)}
        />
      </InspectorSection>

      <InspectorSection title={t("inspector.typography")}>
        <label className={styles.field}>
          <span>{t("inspector.style")}</span>

          <select
            id="text-variant"
            name="textVariant"
            value={element.variant}
            onChange={(event) => attachTextStyle(event.target.value as TextInspectorElement["variant"])}
          >
            {styleOptions.map(({ id, style }) => (
              <option key={id} value={id}>
                {style && "name" in style ? style.name : fundamentalLabels[id] ?? id}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.colorLinkedStatus} role="status">
          <span>
            {element.styleDetached
              ? t("inspector.localTypographyDetached", { style: selectedStyleName })
              : t("inspector.linkedTypographyNamed", { style: selectedStyleName })}
          </span>
          {element.styleDetached && (
            <button type="button" onClick={() => attachTextStyle(element.variant)}>
              {t("inspector.attachTypographyNamed", { style: selectedStyleName })}
            </button>
          )}
          {!element.styleDetached && presentation && (
            <button
              type="button"
              onClick={() => onUpdate((current) => current.type === "text"
                ? detachTextStyle(presentation, current)
                : current)}
            >
              {t("inspector.detachTypographyNamed", { style: selectedStyleName })}
            </button>
          )}
        </div>

        {typographyDefaults && (
          <ElementTypographyFields
            typography={element.typography}
            effectiveDefaults={typographyDefaults}
            onUpdateTypography={updateTypography}
            controlPrefix="text"
            fontResources={fontResources}
          />
        )}
      </InspectorSection>

      <CanonicalTextAppearanceSection
        element={element}
        style={element.style}
        effect={element.effect}
        onUpdateStyle={updateStyle}
        onUpdateEffect={updateEffect}
        controlPrefix="text"
      />

      <CanonicalTextEffectsSection
        effect={element.effect}
        typography={element.typography}
        textColor={typeof element.style?.color === "string" ? element.style.color : undefined}
        onUpdateEffect={updateEffect}
        onUpdateTypography={updateTypography}
        controlPrefix="text"
      />

      {shouldShowElementPositioning(layerControls) && (
        <CanonicalTextPositionSection
          element={element}
          parent={parent}
          layerControls={layerControls}
          onUpdateLayout={(update) => {
            onUpdate((current) => {
              if (current.type !== "text") {
                return current;
              }

              const next = update(current.layout);
              const textLayout = next && "width" in next
                ? Object.fromEntries(Object.entries(next).filter(([key]) => key !== "width" && key !== "height"))
                : next;

              return { ...current, layout: textLayout };
            });
          }}
        />
      )}

      <ElementInteractionSection
        element={element}
        onUpdate={onUpdate}
        controlPrefix="text"
      />
    </>
  );
}

// ============================================================
// END: TEXT INSPECTOR
// ============================================================
