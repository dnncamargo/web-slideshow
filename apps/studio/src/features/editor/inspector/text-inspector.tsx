import {
  type ContainerElement,
  type PresentationElement,
  type TextElement,
  type ElementEffect,
  type ElementTypography,
  type TextVisualStyle,
  FundamentalTextStyleIdSchema,
} from "@web-slideshow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import {
  convertAuthoringLength,
  resolveEffectiveElementStyleDefaults,
  THEME_COLORS,
} from "@web-slideshow/theme/element-style-defaults";

import styles from "../editor-workspace.module.css";

import { RichTextAuthoringControl } from "./rich-text-authoring-control";

import { InspectorSection } from "./inspector-section";

import type {
  CreateQrCodeFromLink,
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
import { ElementSpacingSection } from "./sections/element-spacing-section";
import {
  attachTextStyle as attachTextStyleRelationship,
  detachTextStyle,
  resolveEffectiveTextStyleForAuthoring,
} from "../text-typography-authoring";
import { listPresentationTextStyles } from "../text-style-helpers";
import { useAuthoringHistory } from "../authoring-history-context";
import {
  clearLocalTextStyleProperty,
  getTextStylePropertyInfo,
  type TextStyleInspectorProperty,
} from "./text-style-property";
import type { CoreTypographyProperty } from "./sections/element-typography-control";
import type { ElementSpacingField } from "./sections/element-spacing-section";
import { resolveNearestContainerColor, type InheritedColorSource } from "./color-inheritance";

type TextInspectorElement = Extract<PresentationElement, { type: "text" }>;

// ============================================================
// BEGIN: TEXT INSPECTOR
// ============================================================

export function TextInspector({
  element,
  onUpdate,
  fontResources,
  presentation,
  parent = null,
  ancestorContainers,
  layerControls = null,
  onCreateQrFromLink,
}: TypographyInspectorProps<TextInspectorElement> & {
  parent?: ContainerElement | null;
  ancestorContainers?: readonly ContainerElement[];
  layerControls?: ElementLayerControls | null;
  onCreateQrFromLink?: CreateQrCodeFromLink;
}) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();

  function runStyleRelationship(callback: () => void): void {
    const meta = {
      kind: "element.setting",
      labelKey: "history.element.setting",
      labelParams: { setting: "text.style" },
    } as const;

    if (authoringHistory) {
      authoringHistory.discrete(meta, callback);
    } else {
      callback();
    }
  }

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
  const linkedTextStrokeFallback = element.styleDetached === true
    ? undefined
    : selectedStyle?.typography?.textStroke;
  const resolvedTextStyle = presentation
    ? resolveEffectiveTextStyleForAuthoring(presentation, element)
    : undefined;
  const selectedStyleName = selectedStyle && "name" in selectedStyle
    ? selectedStyle.name
    : fundamentalLabels[element.variant] ?? element.variant;

  const textStyleSourceFor = (property: TextStyleInspectorProperty) =>
    getTextStylePropertyInfo(presentation, element, property);
  const textColorSource = textStyleSourceFor("color");
  const textRole = resolvedTextStyle?.role ?? FundamentalTextStyleIdSchema.parse(element.variant);
  const themeTextColor = textRole === "subtitle"
    ? THEME_COLORS.textSecondary
    : textRole === "caption"
      ? THEME_COLORS.textMuted
      : THEME_COLORS.textPrimary;
  const inheritedContainerColor = resolveNearestContainerColor(
    presentation,
    ancestorContainers !== undefined && ancestorContainers.length > 0
      ? ancestorContainers
      : parent ? [parent] : [],
  );
  const textHasStrongerColor = element.style?.color !== undefined
    || textColorSource?.source === "linked";
  const effectiveTextColorSource: InheritedColorSource | undefined = textHasStrongerColor
    ? undefined
    : inheritedContainerColor === undefined
      ? "theme"
      : "container";
  const fallbackTextColorSource: InheritedColorSource = inheritedContainerColor === undefined ? "theme" : "container";
  const effectiveTextColor = resolvedTextStyle?.style?.color
    ?? inheritedContainerColor
    ?? themeTextColor;
  const typographyProperties: readonly CoreTypographyProperty[] = [
    "fontFamily", "fontSize", "fontWeight", "fontStyle", "textAlign", "lineHeight",
    "letterSpacing", "textTransform", "whiteSpace", "textWrapStyle", "overflowWrap",
    "textDecorationLine",
  ];
  const textStyleSources = presentation && element.styleDetached !== true
    ? Object.fromEntries(typographyProperties.map((property) => [property, textStyleSourceFor(property)])) as Partial<Record<CoreTypographyProperty, NonNullable<ReturnType<typeof textStyleSourceFor>>>>
    : undefined;
  const textStyleLayoutSources = presentation && element.styleDetached !== true
    ? Object.fromEntries(([
        "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
      ] as const).map((property) => [property, textStyleSourceFor(property)])) as Partial<Record<ElementSpacingField, NonNullable<ReturnType<typeof textStyleSourceFor>>>>
    : undefined;

  function resetTextStyleProperty(property: TextStyleInspectorProperty): void {
    if (element.styleDetached === true) return;
    const callback = () => onUpdate((current) => current.type === "text"
      ? clearLocalTextStyleProperty(current, property)
      : current);
    if (authoringHistory) {
      authoringHistory.discrete({
        kind: "element.setting",
        labelKey: "history.element.setting",
        labelParams: { setting: `text.style.${property}` },
      }, callback);
    } else {
      callback();
    }
  }

  function attachTextStyle(variant: TextInspectorElement["variant"]) {
    runStyleRelationship(() => {
      onUpdate((current) => {
        if (current.type !== "text") return current;
        return presentation
          ? attachTextStyleRelationship(presentation, current, variant)
          : (() => {
              const { styleDetached: _styleDetached, ...attached } = current;
              return { ...attached, variant };
            })();
      });
    });
  }

  return (
    <>
      <div className={styles.inspectorDivider} />

      <InspectorSection title={t("inspector.content")} defaultOpen>
        <RichTextAuthoringControl
          content={element.content}
          historyKey={`element:${element.id}:content`}
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
              onClick={() => runStyleRelationship(() => onUpdate((current) => current.type === "text"
                ? detachTextStyle(presentation, current)
                : current))}
            >
              {t("inspector.detachTypographyNamed", { style: selectedStyleName })}
            </button>
          )}
        </div>

        {typographyDefaults && (
          <ElementTypographyFields
            typography={element.typography}
            effectiveTypography={effectiveTypography}
            effectiveDefaults={typographyDefaults}
            onUpdateTypography={updateTypography}
            controlPrefix="text"
            fontResources={fontResources}
            textStyleSources={textStyleSources}
            onResetTextStyleProperty={resetTextStyleProperty}
          />
        )}
      </InspectorSection>

        <ElementSpacingSection
        layout={element.layout}
        effectiveLayout={resolvedTextStyle?.layout}
        textStyleSources={textStyleLayoutSources}
        onResetTextStyleProperty={resetTextStyleProperty}
        controlPrefix="text"
        onUpdateLayout={(update) => {
          onUpdate((current) =>
            current.type === "text"
              ? { ...current, layout: update(current.layout) }
              : current,
          );
        }}
      />

      <CanonicalTextAppearanceSection
        element={element}
        style={element.style}
        effect={element.effect}
        onUpdateStyle={updateStyle}
        onUpdateEffect={updateEffect}
        controlPrefix="text"
        effectiveTextColor={effectiveTextColor}
        effectiveTextColorSource={effectiveTextColorSource}
        fallbackTextColorSource={fallbackTextColorSource}
        textColorSource={textColorSource}
        onResetTextColor={() => resetTextStyleProperty("color")}
      />

      <CanonicalTextEffectsSection
        effect={element.effect}
        typography={element.typography}
        textStrokeFallback={linkedTextStrokeFallback}
        textStrokeSource={textStyleSourceFor("textStroke")}
        onResetTextStroke={() => resetTextStyleProperty("textStroke")}
        textDecorationColorFallback={resolvedTextStyle?.typography?.textDecorationColor}
        textDecorationColorSource={textStyleSourceFor("textDecorationColor")}
        onResetTextDecorationColor={() => resetTextStyleProperty("textDecorationColor")}
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
        onCreateQrFromLink={onCreateQrFromLink}
      />
    </>
  );
}

// ============================================================
// END: TEXT INSPECTOR
// ============================================================
