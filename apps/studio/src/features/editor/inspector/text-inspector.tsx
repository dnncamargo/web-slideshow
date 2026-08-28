import {
  resolveColorValue,
  type ContainerElement,
  type PowerShowElement,
  type TextElement,
  type ElementEffect,
  type ElementTypography,
  type TextVisualStyle,
  stripLocalTypographyStyleProperties,
} from "@powershow/document-schema";
import { useRef, useState } from "react";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import {
  convertAuthoringLength,
  resolveEffectiveElementStyleDefaults,
} from "@powershow/theme/element-style-defaults";

import styles from "../editor-workspace.module.css";

import {
  applyTextContentColor,
  clearTextContentColor,
  clearTextContentFormatting,
  getTextContentPlainText,
  getTextContentSelectionBooleanMarkState,
  getTextContentSelectionColorState,
  normalizeTextContent,
  normalizeTextSelectionRange,
  reconcileTextContentEdit,
  toggleTextContentBooleanMark,
  type TextSelectionRange,
} from "../rich-text-authoring";

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

import { ColorControl } from "./sections/color-control";
import { ElementTypographyFields } from "./sections/element-typography-control";
import { usePresentationColorPalette } from "./sections/presentation-color-palette";
import { resolveEffectiveTextTypographyForAuthoring } from "../text-typography-authoring";
import { listPresentationTypographyStyles } from "../typography-style-helpers";

type TextInspectorElement = Extract<PowerShowElement, { type: "text" }>;

function readTextareaSelection(
  textarea: HTMLTextAreaElement,
): TextSelectionRange | null {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  if (start === null || end === null) {
    return null;
  }

  return normalizeTextSelectionRange(
    {
      start,
      end,
    },
    textarea.value.length,
  );
}

function InlineFormatButton({
  format,
  accessibleLabel,
  visualLabel,
  state,
  disabled,
  onClick,
}: {
  format: "bold" | "italic" | "underline" | "code";
  accessibleLabel: string;
  visualLabel: string;
  state: "off" | "on" | "mixed" | null;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={styles.textEditorToolbarButton}
      type="button"
      aria-label={accessibleLabel}
      aria-pressed={state === "mixed" ? "mixed" : state === "on"}
      disabled={disabled}
      data-powershow-inline-format={format}
      title={accessibleLabel}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={onClick}
    >
      <span aria-hidden="true">{visualLabel}</span>
    </button>
  );
}

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
  const selectionRef = useRef<TextSelectionRange | null>(null);
  const [selection, setSelection] = useState<TextSelectionRange | null>(null);
  const [isInlineColorOpen, setIsInlineColorOpen] = useState(false);
  const presentationPalette = usePresentationColorPalette();

  const plainText = getTextContentPlainText(element.content);
  const normalizedSelection = normalizeTextSelectionRange(
    selection,
    plainText.length,
  );
  const hasSelection = normalizedSelection !== null;
  const selectionColorState = getTextContentSelectionColorState(
    element.content,
    normalizedSelection,
  );
  const selectionColor = selectionColorState?.kind === "uniform"
    ? selectionColorState.color
    : undefined;
  const resolvedSelectionColor = selectionColor === undefined
    ? undefined
    : resolveColorValue(
        selectionColor,
        presentationPalette ? { colors: presentationPalette.colors } : undefined,
      );
  const isColorPanelOpen = isInlineColorOpen && hasSelection;

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
    ? resolveEffectiveTextTypographyForAuthoring(presentation, element).typography
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
  const styleOptions = listPresentationTypographyStyles(presentation ?? { typographyStyles: [] });
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

  function attachTypographyStyle(variant: TextInspectorElement["variant"]) {
    onUpdate((current) => {
      if (current.type !== "text") return current;
      const { typographyDetached: _detached, ...attached } = current;
      const typography = stripLocalTypographyStyleProperties(current.typography);
      return {
        ...attached,
        variant,
        ...(typography === undefined ? {} : { typography }),
      };
    });
  }

  function updateTextElementContent(
    update: (content: TextElement["content"]) => TextElement["content"],
  ) {
    onUpdate((current) => {
      if (current.type !== "text") {
        return current;
      }

      const nextContent = normalizeTextContent(update(current.content));

      return nextContent === current.content
        ? current
        : {
            ...current,
            content: nextContent,
          };
    });
  }

  function updateSelectionFromTextarea(textarea: HTMLTextAreaElement) {
    const nextSelection = readTextareaSelection(textarea);

    setSelection(nextSelection);

    if (nextSelection) {
      selectionRef.current = nextSelection;
    }
  }

  function applySelectionTransform(
    transform: (
      content: TextElement["content"],
      selectionRange: TextSelectionRange,
    ) => TextElement["content"],
  ) {
    const nextSelection = selectionRef.current;
    if (!nextSelection) {
      return;
    }

    updateTextElementContent((content) => {
      const normalized = normalizeTextSelectionRange(
        nextSelection,
        getTextContentPlainText(content).length,
      );

      if (!normalized) {
        return content;
      }

      return transform(content, normalized);
    });

    setSelection(nextSelection);
    selectionRef.current = nextSelection;
  }

  return (
    <>
      <div className={styles.inspectorDivider} />

      <InspectorSection title={t("inspector.content")} defaultOpen>
        <div className={styles.textEditor} data-powershow-text-editor="true">
          <div
            className={styles.textEditorToolbar}
            data-powershow-text-editor-toolbar="true"
          >
            <InlineFormatButton
              format="bold"
              accessibleLabel={t("inspector.inlineFormat.bold")}
              visualLabel="B"
              state={getTextContentSelectionBooleanMarkState(
                element.content,
                normalizedSelection,
                "bold",
              )}
              disabled={!hasSelection}
              onClick={() => {
                applySelectionTransform((content, range) =>
                  toggleTextContentBooleanMark(content, range, "bold"),
                );
              }}
            />

            <InlineFormatButton
              format="italic"
              accessibleLabel={t("inspector.inlineFormat.italic")}
              visualLabel="I"
              state={getTextContentSelectionBooleanMarkState(
                element.content,
                normalizedSelection,
                "italic",
              )}
              disabled={!hasSelection}
              onClick={() => {
                applySelectionTransform((content, range) =>
                  toggleTextContentBooleanMark(content, range, "italic"),
                );
              }}
            />

            <InlineFormatButton
              format="underline"
              accessibleLabel={t("inspector.inlineFormat.underline")}
              visualLabel="U"
              state={getTextContentSelectionBooleanMarkState(
                element.content,
                normalizedSelection,
                "underline",
              )}
              disabled={!hasSelection}
              onClick={() => {
                applySelectionTransform((content, range) =>
                  toggleTextContentBooleanMark(content, range, "underline"),
                );
              }}
            />

            <InlineFormatButton
              format="code"
              accessibleLabel={t("inspector.inlineFormat.code")}
              visualLabel="</>"
              state={getTextContentSelectionBooleanMarkState(
                element.content,
                normalizedSelection,
                "code",
              )}
              disabled={!hasSelection}
              onClick={() => {
                applySelectionTransform((content, range) =>
                  toggleTextContentBooleanMark(content, range, "code"),
                );
              }}
            />

            <button
              className={styles.textEditorToolbarButton}
              type="button"
              aria-label={t("inspector.inlineFormat.color")}
              aria-expanded={isColorPanelOpen}
              aria-controls="text-inline-color-panel"
              disabled={!hasSelection}
              data-powershow-inline-color="true"
              data-powershow-inline-color-state={selectionColorState?.kind ?? "none"}
              title={t("inspector.inlineFormat.color")}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={() => setIsInlineColorOpen((open) => !open)}
            >
              <svg
                aria-hidden="true"
                className={styles.textEditorColorIcon}
                data-powershow-inline-color-icon="paint-bucket"
                viewBox="0 0 24 24"
                focusable="false"
              >
                <path
                  d="m4.5 9 5-5 9 9-5 5-9-9Z"
                  fill={resolvedSelectionColor ?? "currentColor"}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.7"
                />
                <path
                  d="m9.5 4 2-2 9 9-2 2M4.5 9l-2 2 7 7"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.7"
                />
                <path
                  d="M17.5 16.5c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5c0-1.4 2.5-4 2.5-4s2.5 2.6 2.5 4Z"
                  fill={resolvedSelectionColor ?? "currentColor"}
                  stroke="currentColor"
                  strokeLinejoin="round"
                  strokeWidth="1.4"
                />
                <path
                  d="M19 20h2"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.7"
                />
              </svg>
              <span
                aria-hidden="true"
                className={styles.textEditorColorSwatch}
                data-powershow-inline-color-swatch="true"
                style={{ backgroundColor: resolvedSelectionColor ?? "currentColor" }}
              />
            </button>

            <button
              className={styles.textEditorToolbarButton}
              type="button"
              aria-label={t("inspector.inlineFormat.clearFormatting")}
              disabled={!hasSelection}
              data-powershow-inline-format-clear-formatting="true"
              title={t("inspector.inlineFormat.clearFormatting")}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={() => {
                applySelectionTransform((content, range) =>
                  clearTextContentFormatting(content, range),
                );
              }}
            >T×</button>
          </div>

          {isColorPanelOpen && (
            <div
              className={styles.textEditorColorPanel}
              id="text-inline-color-panel"
              data-powershow-inline-color-panel="true"
            >
              {selectionColorState?.kind === "mixed" ? (
                <p className={styles.textEditorColorMixedStatus} role="status">
                  {t("inspector.inlineFormat.mixed")}
                </p>
              ) : null}
              <ColorControl
                id="text-inline-color"
                name="textInlineColor"
                value={selectionColor}
                disabled={!hasSelection}
                onChange={(color) => {
                  applySelectionTransform((content, range) =>
                    applyTextContentColor(content, range, color),
                  );
                }}
                secondaryAction={{
                  label: t("inspector.inlineFormat.clearColor"),
                  onClick: () => {
                    applySelectionTransform((content, range) =>
                      clearTextContentColor(content, range),
                    );
                  },
                }}
              />
            </div>
          )}

          <textarea
            id="text-content"
            name="textContent"
            className={styles.textArea}
            aria-label={t("inspector.text")}
            rows={5}
            value={plainText}
            onSelect={(event) => {
              updateSelectionFromTextarea(event.currentTarget);
            }}
            onMouseUp={(event) => {
              updateSelectionFromTextarea(event.currentTarget);
            }}
            onClick={(event) => {
              updateSelectionFromTextarea(event.currentTarget);
            }}
            onKeyUp={(event) => {
              updateSelectionFromTextarea(event.currentTarget);
            }}
            onChange={(event) => {
              const content = event.currentTarget.value;

              updateTextElementContent((currentContent) =>
                reconcileTextContentEdit(currentContent, content),
              );
              updateSelectionFromTextarea(event.currentTarget);
            }}
          />
        </div>
      </InspectorSection>

      <InspectorSection title={t("inspector.typography")}>
        <label className={styles.field}>
          <span>{t("inspector.style")}</span>

          <select
            id="text-variant"
            name="textVariant"
            value={element.variant}
            onChange={(event) => attachTypographyStyle(event.target.value as TextInspectorElement["variant"])}
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
            {element.typographyDetached
              ? `${t("inspector.localTypography")} · ${selectedStyleName}`
              : `${t("inspector.linkedTypography")} · ${selectedStyleName}`}
          </span>
          {element.typographyDetached && (
            <button type="button" onClick={() => attachTypographyStyle(element.variant)}>
              {t("inspector.attachTypography")}
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
