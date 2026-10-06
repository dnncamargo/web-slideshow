"use client";

import { useState, type KeyboardEvent } from "react";

import type { PresentationTextFileResource } from "@web-slideshow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "./presentation-text-file-editor.module.css";

type IndentationMode = "2" | "4" | "tab";

const pairedDelimiters = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'",
  "`": "`",
} as const;

function getIndentationUnit(mode: IndentationMode): string {
  if (mode === "tab") return "\t";
  return " ".repeat(Number(mode));
}

function replaceTextareaSelection(
  textarea: HTMLTextAreaElement,
  selectionStart: number,
  selectionEnd: number,
  replacement: string,
): boolean {
  textarea.focus();
  textarea.setSelectionRange(selectionStart, selectionEnd);

  if (typeof document.execCommand === "function" && document.execCommand("insertText", false, replacement)) {
    return true;
  }

  textarea.setRangeText(replacement, selectionStart, selectionEnd, "end");
  return false;
}

export function PresentationTextFileEditor({
  file,
  onSave,
  onExit,
}: {
  file: PresentationTextFileResource;
  onSave: (content: string) => void;
  onExit: () => void;
}) {
  const { t } = useStudioI18n();
  const [draft, setDraft] = useState(file.source.content);
  const [indentationMode, setIndentationMode] = useState<IndentationMode>("2");
  const dirty = draft !== file.source.content;

  function handleTab(event: KeyboardEvent<HTMLTextAreaElement>): void {
    event.preventDefault();

    const textarea = event.currentTarget;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const unit = getIndentationUnit(indentationMode);

    if (!event.shiftKey) {
      const usedNativeEdit = replaceTextareaSelection(textarea, selectionStart, selectionEnd, unit);
      if (!usedNativeEdit) setDraft(textarea.value);
      return;
    }

    const lineStart = textarea.value.lastIndexOf("\n", selectionStart - 1) + 1;
    const removeCount = indentationMode === "tab"
      ? textarea.value[lineStart] === "\t" ? 1 : 0
      : Math.min(Number(indentationMode), textarea.value.slice(lineStart).search(/[^ ]|$/));

    if (removeCount === 0) return;

    const usedNativeEdit = replaceTextareaSelection(textarea, lineStart, lineStart + removeCount, "");

    const nextSelectionStart = Math.max(lineStart, selectionStart - removeCount);
    const nextSelectionEnd = Math.max(nextSelectionStart, selectionEnd - removeCount);
    textarea.setSelectionRange(nextSelectionStart, nextSelectionEnd);
    if (!usedNativeEdit) setDraft(textarea.value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;

    if (event.key === "Tab") {
      handleTab(event);
      return;
    }

    const textarea = event.currentTarget;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const closer = pairedDelimiters[event.key as keyof typeof pairedDelimiters];

    if (closer) {
      if (event.key === closer && textarea.value[selectionStart] === closer && selectionStart === selectionEnd) {
        event.preventDefault();
        textarea.setSelectionRange(selectionStart + 1, selectionStart + 1);
        return;
      }

      event.preventDefault();
      const usedNativeEdit = replaceTextareaSelection(
        textarea,
        selectionStart,
        selectionEnd,
        `${event.key}${textarea.value.slice(selectionStart, selectionEnd)}${closer}`,
      );
      const nextSelectionStart = selectionStart + 1;
      const nextSelectionEnd = selectionEnd + 1;
      textarea.setSelectionRange(nextSelectionStart, nextSelectionEnd);
      if (!usedNativeEdit) setDraft(textarea.value);
      return;
    }

    if ((event.key === ")" || event.key === "]" || event.key === "}")
      && textarea.value[selectionStart] === event.key
      && selectionStart === selectionEnd) {
      event.preventDefault();
      textarea.setSelectionRange(selectionStart + 1, selectionStart + 1);
    }
  }

  return (
    <>
      <aside className={styles.contextPanel} data-text-file-context>
        <div className={styles.contextHeader}>{t("editor.textFileEditing")}</div>
        <div className={styles.contextContent}>
          <h2 className={styles.fileName}>{file.name}</h2>
          <dl className={styles.metadata}>
            <div className={styles.metadataRow}>
              <dt className={styles.metadataLabel}>{t("editor.textFileKind")}</dt>
              <dd className={styles.metadataValue}>{t(`customLibrary.file.kind.${file.kind}`)}</dd>
            </div>
            <div className={styles.metadataRow}>
              <dt className={styles.metadataLabel}>{t("editor.textFileContentType")}</dt>
              <dd className={styles.metadataValue}>{file.contentType}</dd>
            </div>
          </dl>
          <p className={`${styles.status} ${dirty ? styles.statusModified : ""}`} data-text-file-status>
            {dirty ? t("editor.textFileModified") : t("editor.textFileClean")}
          </p>
        </div>
      </aside>

      <section className={styles.editorArea} data-text-file-editor-region>
        <div className={styles.editorToolbar}>
          <span className={styles.editorToolbarTitle}>{file.name}</span>
          <div className={styles.editorToolbarActions}>
            <label className={styles.indentationControl}>
              <span>{t("editor.textFileIndent")}</span>
              <select
                aria-label={t("editor.textFileIndent")}
                data-text-file-indent
                value={indentationMode}
                onChange={(event) => setIndentationMode(event.target.value as IndentationMode)}
              >
                <option value="2">{t("editor.textFileIndentTwo")}</option>
                <option value="4">{t("editor.textFileIndentFour")}</option>
                <option value="tab">{t("editor.textFileIndentTab")}</option>
              </select>
            </label>
            <button
              type="button"
              className={styles.toolbarAction}
              data-text-file-action="save"
              onClick={() => {
                if (dirty) onSave(draft);
              }}
            >
              {t("topbar.save")}
            </button>
            <button
              type="button"
              className={styles.toolbarAction}
              data-text-file-action="discard"
              disabled={!dirty}
              onClick={() => setDraft(file.source.content)}
            >
              {t("editor.textFileDiscard")}
            </button>
            <button
              type="button"
              className={`${styles.toolbarAction} ${styles.exitAction}`}
              data-text-file-action="exit"
              disabled={dirty}
              onClick={onExit}
            >
              {t("editor.exitTextEditing")}
            </button>
          </div>
        </div>
        <textarea
          className={styles.textArea}
          data-text-file-editor
          aria-label={t("editor.textFileEditor")}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
        />
      </section>
    </>
  );
}
