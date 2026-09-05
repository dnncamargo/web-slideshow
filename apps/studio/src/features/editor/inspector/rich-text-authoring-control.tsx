import {
  resolveColorValue,
  type ColorValue,
  type TextContent,
} from "@powershow/document-schema";
import { useLayoutEffect, useRef, useState } from "react";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

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
import { ColorControl } from "./sections/color-control";
import { usePresentationColorPalette } from "./sections/presentation-color-palette";

type TextInputElement = HTMLTextAreaElement | HTMLInputElement;

function readTextareaSelection(
  textarea: TextInputElement,
): TextSelectionRange | null {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  if (start === null || end === null) {
    return null;
  }

  return normalizeTextSelectionRange(
    { start, end },
    textarea.value.length,
  );
}

function readTextareaRange(
  textarea: TextInputElement,
): TextSelectionRange | null {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  return start === null || end === null ? null : { start, end };
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

export interface RichTextAuthoringControlProps {
  content: TextContent;
  onChange: (content: TextContent) => void;
  id?: string;
  name?: string;
  multiline?: boolean;
  rows?: number;
  visibleMarks?: Partial<Record<"bold" | "italic" | "underline" | "code", boolean>>;
  showLineBreak?: boolean;
  placeholder?: string;
  ariaLabel?: string;
}

export function RichTextAuthoringControl({
  content,
  onChange,
  id = "text-content",
  name = "textContent",
  multiline = true,
  rows = 5,
  visibleMarks = { bold: true, italic: true, underline: true, code: true },
  showLineBreak = true,
  placeholder,
  ariaLabel,
}: RichTextAuthoringControlProps) {
  const { t } = useStudioI18n();
  const selectionRef = useRef<TextSelectionRange | null>(null);
  const textRangeRef = useRef<TextSelectionRange | null>(null);
  const textareaRef = useRef<TextInputElement | null>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const [selection, setSelection] = useState<TextSelectionRange | null>(null);
  const [isInlineColorOpen, setIsInlineColorOpen] = useState(false);
  const presentationPalette = usePresentationColorPalette();

  const plainText = getTextContentPlainText(content);
  const normalizedSelection = normalizeTextSelectionRange(
    selection,
    plainText.length,
  );
  const hasSelection = normalizedSelection !== null;
  const selectionColorState = getTextContentSelectionColorState(
    content,
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

  useLayoutEffect(() => {
    const caret = pendingCaretRef.current;
    const textarea = textareaRef.current;

    if (caret === null || !textarea) {
      return;
    }

    textarea.focus();
    textarea.setSelectionRange(caret, caret);
    textRangeRef.current = { start: caret, end: caret };
    selectionRef.current = null;
    setSelection(null);
    pendingCaretRef.current = null;
  }, [plainText]);

  function updateContent(update: (current: TextContent) => TextContent) {
    onChange(normalizeTextContent(update(content)));
  }

  function updateSelectionFromTextarea(textarea: TextInputElement) {
    textRangeRef.current = readTextareaRange(textarea);
    const nextSelection = readTextareaSelection(textarea);

    setSelection(nextSelection);

    if (nextSelection) {
      selectionRef.current = nextSelection;
    }
  }

  function insertLineBreak() {
    const range = textRangeRef.current;
    if (!range) {
      return;
    }

    const start = Math.min(Math.max(range.start, 0), plainText.length);
    const end = Math.min(Math.max(range.end, start), plainText.length);
    const nextText = `${plainText.slice(0, start)}\n${plainText.slice(end)}`;

    updateContent((current) => reconcileTextContentEdit(current, nextText));
    pendingCaretRef.current = start + 1;
  }

  function applySelectionTransform(
    transform: (content: TextContent, range: TextSelectionRange) => TextContent,
  ) {
    const nextSelection = selectionRef.current;
    if (!nextSelection) {
      return;
    }

    updateContent((current) => {
      const normalized = normalizeTextSelectionRange(
        nextSelection,
        getTextContentPlainText(current).length,
      );

      return normalized ? transform(current, normalized) : current;
    });

    setSelection(nextSelection);
    selectionRef.current = nextSelection;
  }

  return (
    <div className={styles.textEditor} data-powershow-text-editor="true">
      <div
        className={styles.textEditorToolbar}
        data-powershow-text-editor-toolbar="true"
      >
        {(["bold", "italic", "underline", "code"] as const).filter((format) => visibleMarks[format] !== false).map((format) => (
          <InlineFormatButton
            key={format}
            format={format}
            accessibleLabel={t(`inspector.inlineFormat.${format}`)}
            visualLabel={format === "code" ? "</>" : format[0]!.toUpperCase()}
            state={getTextContentSelectionBooleanMarkState(
              content,
              normalizedSelection,
              format,
            )}
            disabled={!hasSelection}
            onClick={() => {
              applySelectionTransform((current, range) =>
                toggleTextContentBooleanMark(current, range, format),
              );
            }}
          />
        ))}

        {showLineBreak && <button
          className={styles.textEditorToolbarButton}
          type="button"
          aria-label={t("inspector.inlineFormat.lineBreak")}
          data-powershow-inline-line-break="true"
          title={t("inspector.inlineFormat.lineBreak")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={insertLineBreak}
        >
          <span aria-hidden="true">↵</span>
        </button>
        }

        <button
          className={styles.textEditorToolbarButton}
          type="button"
          aria-label={t("inspector.inlineFormat.color")}
          aria-expanded={isColorPanelOpen}
          aria-controls={`${id.replace(/-content$/, "")}-inline-color-panel`}
          disabled={!hasSelection}
          data-powershow-inline-color="true"
          data-powershow-inline-color-state={selectionColorState?.kind ?? "none"}
          title={t("inspector.inlineFormat.color")}
          onMouseDown={(event) => event.preventDefault()}
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
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            applySelectionTransform((current, range) =>
              clearTextContentFormatting(current, range),
            );
          }}
        >
          T×
        </button>
      </div>

      {isColorPanelOpen && (
        <div
          className={styles.textEditorColorPanel}
          id={`${id.replace(/-content$/, "")}-inline-color-panel`}
          data-powershow-inline-color-panel="true"
        >
          {selectionColorState?.kind === "mixed" ? (
            <p className={styles.textEditorColorMixedStatus} role="status">
              {t("inspector.inlineFormat.mixed")}
            </p>
          ) : null}
          <ColorControl
            id={`${id.replace(/-content$/, "")}-inline-color`}
            name={`${name}InlineColor`}
            value={selectionColor}
            disabled={!hasSelection}
            onChange={(color: ColorValue) => {
              applySelectionTransform((current, range) =>
                applyTextContentColor(current, range, color),
              );
            }}
            secondaryAction={{
              label: t("inspector.inlineFormat.clearColor"),
              onClick: () => {
                applySelectionTransform((current, range) =>
                  clearTextContentColor(current, range),
                );
              },
            }}
          />
        </div>
      )}

      {multiline ? <textarea
        id={id}
        name={name}
        className={styles.textArea}
        ref={(node) => {
          textareaRef.current = node;
        }}
        aria-label={ariaLabel ?? t("inspector.text")}
        placeholder={placeholder}
        rows={rows}
        value={plainText}
        onSelect={(event) => updateSelectionFromTextarea(event.currentTarget)}
        onMouseUp={(event) => updateSelectionFromTextarea(event.currentTarget)}
        onClick={(event) => updateSelectionFromTextarea(event.currentTarget)}
        onKeyUp={(event) => updateSelectionFromTextarea(event.currentTarget)}
        onChange={(event) => {
          updateContent((current) =>
            reconcileTextContentEdit(current, event.currentTarget.value),
          );
          updateSelectionFromTextarea(event.currentTarget);
        }}
      /> : <input
        id={id}
        name={name}
        type="text"
        className={styles.textArea}
        ref={(node) => {
          textareaRef.current = node;
        }}
        aria-label={ariaLabel ?? t("inspector.text")}
        placeholder={placeholder}
        value={plainText}
        onSelect={(event) => updateSelectionFromTextarea(event.currentTarget)}
        onMouseUp={(event) => updateSelectionFromTextarea(event.currentTarget)}
        onClick={(event) => updateSelectionFromTextarea(event.currentTarget)}
        onKeyUp={(event) => updateSelectionFromTextarea(event.currentTarget)}
        onChange={(event) => {
          updateContent((current) =>
            reconcileTextContentEdit(current, event.currentTarget.value.replace(/[\r\n]/g, "")),
          );
          updateSelectionFromTextarea(event.currentTarget);
        }}
      />}
    </div>
  );
}
