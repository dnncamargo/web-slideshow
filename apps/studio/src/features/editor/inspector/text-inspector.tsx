import {
  resolveColorValue,
  type PowerShowElement,
  type TextElement,
  type ElementEffect,
  type ElementTypography,
  type TextVisualStyle,
} from "@powershow/document-schema";
import { useRef, useState } from "react";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import { resolveEffectiveElementStyleDefaults } from "@powershow/theme/element-style-defaults";

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

import { CanonicalTextEffectsSection } from "./sections/canonical-text-effects-section";

import { ColorControl } from "./sections/color-control";
import { ElementTypographyFields } from "./sections/element-typography-control";
import { usePresentationColorPalette } from "./sections/presentation-color-palette";

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
}: TypographyInspectorProps<TextInspectorElement>) {
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

  const typographyDefaults = resolveEffectiveElementStyleDefaults(element).typography;

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
              <span aria-hidden="true" className={styles.textEditorColorGlyph}>A</span>
              <span
                aria-hidden="true"
                className={styles.textEditorColorSwatch}
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
            onChange={(event) => {
              const variant = event.target.value as TextInspectorElement["variant"];

              onUpdate((current) => {
                if (current.type !== "text") {
                  return current;
                }

                return { ...current, variant };
              });
            }}
          >
            <option value="title">{t("inspector.titleField")}</option>
            <option value="subtitle">{t("inspector.subtitle")}</option>
            <option value="body">{t("inspector.body")}</option>
            <option value="caption">{t("inspector.caption")}</option>
          </select>
        </label>

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
