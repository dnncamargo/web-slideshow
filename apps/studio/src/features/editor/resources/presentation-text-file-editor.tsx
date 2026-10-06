"use client";

import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PresentationTextFileResource } from "@web-slideshow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "./presentation-text-file-editor.module.css";

type IndentationMode = "2" | "4" | "tab";

function getIndentationUnit(mode: IndentationMode): string {
  if (mode === "tab") return "\t";
  return " ".repeat(Number(mode));
}

const editorSyntaxHighlightStyle = HighlightStyle.define([
  { tag: [tags.tagName, tags.propertyName], color: "var(--text-editor-syntax-property)" },
  { tag: tags.attributeName, color: "var(--text-editor-syntax-attribute)" },
  { tag: [tags.string, tags.attributeValue], color: "var(--text-editor-syntax-string)" },
  { tag: tags.number, color: "var(--text-editor-syntax-number)" },
  { tag: [tags.bool, tags.null, tags.keyword, tags.atom], color: "var(--text-editor-syntax-keyword)" },
  { tag: [tags.comment, tags.meta], color: "var(--text-editor-syntax-comment)" },
  { tag: tags.invalid, color: "var(--text-editor-syntax-invalid)" },
]);

function getEditorLanguage(contentType: PresentationTextFileResource["contentType"]): Extension {
  if (contentType === "application/json") return json();
  if (contentType === "application/xml" || contentType === "image/svg+xml") return xml();
  return [];
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
  const editorHostRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const indentationCompartmentRef = useRef(new Compartment());
  const initialContentRef = useRef(file.source.content);
  const languageExtension = useMemo(() => getEditorLanguage(file.contentType), [file.contentType]);
  const editorExtensions = useMemo<Extension[]>(() => [
    languageExtension,
    syntaxHighlighting(editorSyntaxHighlightStyle),
    bracketMatching(),
    EditorState.languageData.of(() => [{
      closeBrackets: { brackets: ["(", "[", "{", "'", "\"", "`"] },
    }]),
    closeBrackets(),
    indentOnInput(),
    history(),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab,
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) setDraft(update.state.doc.toString());
    }),
  ], [languageExtension]);
  const createEditorState = useCallback((content: string, mode: IndentationMode): EditorState => EditorState.create({
    doc: content,
    extensions: [
      ...editorExtensions,
      indentationCompartmentRef.current.of(indentUnit.of(getIndentationUnit(mode))),
    ],
  }), [editorExtensions]);
  const dirty = draft !== file.source.content;

  useEffect(() => {
    const parent = editorHostRef.current;
    if (!parent) return;

    const view = new EditorView({
      state: createEditorState(initialContentRef.current, "2"),
      parent,
    });

    view.dom.dataset.textFileEditor = "";
    editorViewRef.current = view;

    return () => {
      editorViewRef.current = null;
      view.destroy();
    };
  }, [createEditorState]);

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;

    view.dispatch({
      effects: indentationCompartmentRef.current.reconfigure(
        indentUnit.of(getIndentationUnit(indentationMode)),
      ),
    });
  }, [indentationMode]);

  function getCurrentDraft(): string {
    return editorViewRef.current?.state.doc.toString() ?? draft;
  }

  function handleDiscard(): void {
    const view = editorViewRef.current;
    if (!view) return;

    view.setState(createEditorState(file.source.content, indentationMode));
    setDraft(file.source.content);
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
                const content = getCurrentDraft();
                if (content !== file.source.content) onSave(content);
              }}
            >
              {t("topbar.save")}
            </button>
            <button
              type="button"
              className={styles.toolbarAction}
              data-text-file-action="discard"
              disabled={!dirty}
              onClick={handleDiscard}
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
        <div
          ref={editorHostRef}
          className={styles.editorHost}
          data-text-file-editor
          aria-label={t("editor.textFileEditor")}
        />
      </section>
    </>
  );
}
