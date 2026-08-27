import type {
  Color,
  ColorValue,
  PowerShowElement,
  TextElement,
  ElementEffect,
  ElementTypography,
  TextVisualStyle,
} from "@powershow/document-schema";
import { useEffect, useRef, useState } from "react";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import {
  applyTextContentColor,
  clearTextContentColor,
  getTextContentPlainText,
  getTextContentSelectionBooleanMarkState,
  getTextContentSelectionColor,
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

function selectionEquals(
  left: TextSelectionRange | null,
  right: TextSelectionRange | null,
): boolean {
  return (
    left?.start === right?.start &&
    left?.end === right?.end
  );
}

function InlineFormatButton({
  format,
  label,
  active,
  disabled,
  onClick,
}: {
  format: "bold" | "italic" | "underline" | "code";
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={styles.secondaryButton}
      type="button"
      aria-pressed={active}
      disabled={disabled}
      data-powershow-inline-format={format}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={onClick}
    >
      {label}
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
  const [inlineColor, setInlineColor] = useState<ColorValue | undefined>(undefined);

  const plainText = getTextContentPlainText(element.content);
  const normalizedSelection = normalizeTextSelectionRange(
    selection,
    plainText.length,
  );
  const hasSelection = normalizedSelection !== null;
  const selectionColor = getTextContentSelectionColor(
    element.content,
    normalizedSelection,
  );

  useEffect(() => {
    setInlineColor(selectionColor);
  }, [selectionColor]);

  useEffect(() => {
    const nextSelection = normalizeTextSelectionRange(selection, plainText.length);

    if (!selectionEquals(selection, nextSelection)) {
      setSelection(nextSelection);

      if (nextSelection) {
        selectionRef.current = nextSelection;
      }
    }
  }, [plainText.length, selection]);

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
        <div className={styles.inlineFormattingToolbar}>
          <span className={styles.fieldHint}>
            {t("inspector.inlineFormattingHint")}
          </span>

          <div className={styles.inlineFormattingButtonRow}>
            <InlineFormatButton
              format="bold"
              label={t("inspector.inlineFormat.bold")}
              active={getTextContentSelectionBooleanMarkState(
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
              label={t("inspector.inlineFormat.italic")}
              active={getTextContentSelectionBooleanMarkState(
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
              label={t("inspector.inlineFormat.underline")}
              active={getTextContentSelectionBooleanMarkState(
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
              label={t("inspector.inlineFormat.code")}
              active={getTextContentSelectionBooleanMarkState(
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
          </div>

          <div className={styles.inlineFormattingColorRow}>
            <label className={styles.field}>
              <span>{t("inspector.inlineFormat.color")}</span>

              <ColorControl
                id="text-inline-color"
                name="textInlineColor"
                value={inlineColor}
                disabled={!hasSelection}
                onChange={(color) => {
                  setInlineColor(color);

                  applySelectionTransform((content, range) =>
                    applyTextContentColor(content, range, color),
                  );
                }}
              />
            </label>

            <button
              className={styles.secondaryButton}
              type="button"
              disabled={!hasSelection}
              data-powershow-inline-format-clear="true"
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={() => {
                applySelectionTransform((content, range) =>
                  clearTextContentColor(content, range),
                );
              }}
            >
              {t("inspector.inlineFormat.clearColor")}
            </button>
          </div>
        </div>

        <label className={styles.field}>
          <span>{t("inspector.text")}</span>

          <textarea
            id="text-content"
            name="textContent"
            className={styles.textArea}
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
        </label>

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

                return {
                  ...current,

                  variant,
                };
              });
            }}
          >
            <option value="title">{t("inspector.titleField")}</option>

            <option value="subtitle">{t("inspector.subtitle")}</option>

            <option value="body">{t("inspector.body")}</option>

            <option value="caption">{t("inspector.caption")}</option>
          </select>
        </label>
      </InspectorSection>

      <ElementInteractionSection
        element={element}
        onUpdate={onUpdate}
        controlPrefix="text"
      />

      <CanonicalTextAppearanceSection
        element={element}
        style={element.style}
        typography={element.typography}
        effect={element.effect}
        onUpdateStyle={updateStyle}
        onUpdateTypography={updateTypography}
        onUpdateEffect={updateEffect}
        controlPrefix="text"
        fontResources={fontResources}
      />

      <CanonicalTextEffectsSection
        effect={element.effect}
        typography={element.typography}
        textColor={typeof element.style?.color === "string" ? element.style.color : undefined}
        onUpdateEffect={updateEffect}
        onUpdateTypography={updateTypography}
        controlPrefix="text"
      />
    </>
  );
}

// ============================================================
// END: TEXT INSPECTOR
// ============================================================
