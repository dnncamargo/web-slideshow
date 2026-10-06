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
import type { Plugin } from "prettier";

import type { PresentationTextFileResource } from "@web-slideshow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "./presentation-text-file-editor.module.css";

type IndentationMode = "2" | "4" | "tab";
type FormatterParser = "json" | "xml";

interface FormatterModules {
  formatWithCursor: typeof import("prettier/standalone").formatWithCursor;
  jsonPlugins: Plugin[];
  xmlPlugins: Plugin[];
}

let formatterModulesPromise: Promise<FormatterModules> | null = null;

function loadFormatterModules(): Promise<FormatterModules> {
  formatterModulesPromise ??= Promise.all([
    import("prettier/standalone"),
    import("prettier/plugins/babel"),
    import("prettier/plugins/estree"),
    import("@prettier/plugin-xml"),
  ]).then(([prettier, babel, estree, xml]) => ({
    formatWithCursor: prettier.formatWithCursor,
    jsonPlugins: [babel, estree],
    xmlPlugins: [xml.default],
  }));
  return formatterModulesPromise;
}

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

function getFormatterParser(contentType: PresentationTextFileResource["contentType"]): FormatterParser | null {
  if (contentType === "application/json") return "json";
  if (contentType === "application/xml" || contentType === "image/svg+xml") return "xml";
  return null;
}

export function PresentationTextFileEditor({
  file,
  onSave,
  onExit,
  onDirtyChange,
}: {
  file: PresentationTextFileResource;
  onSave: (content: string) => void;
  onExit: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { t } = useStudioI18n();
  const [draft, setDraft] = useState(file.source.content);
  const [indentationMode, setIndentationMode] = useState<IndentationMode>("2");
  const [formatting, setFormatting] = useState(false);
  const [formatError, setFormatError] = useState(false);
  const editorHostRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const indentationCompartmentRef = useRef(new Compartment());
  const initialContentRef = useRef(file.source.content);
  const formattingRef = useRef(false);
  const indentationModeRef = useRef(indentationMode);
  const formatterParser = getFormatterParser(file.contentType);
  const languageExtension = useMemo(() => getEditorLanguage(file.contentType), [file.contentType]);
  const formatKeymap = useMemo(() => formatterParser === null ? [] : [{
    key: "Alt-Shift-f",
    run: (view: EditorView) => {
      view.dom.dispatchEvent(new Event("presentation-text-file-format", { bubbles: true }));
      return true;
    },
  }], [formatterParser]);
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
      ...formatKeymap,
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        setDraft(update.state.doc.toString());
        setFormatError(false);
      }
    }),
  ], [formatKeymap, languageExtension]);
  const createEditorState = useCallback((content: string, mode: IndentationMode): EditorState => EditorState.create({
    doc: content,
    extensions: [
      ...editorExtensions,
      indentationCompartmentRef.current.of(indentUnit.of(getIndentationUnit(mode))),
    ],
  }), [editorExtensions]);
  const dirty = draft !== file.source.content;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

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
    indentationModeRef.current = indentationMode;
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

  const formatCode = useCallback(async (): Promise<void> => {
    if (formatterParser === null || formattingRef.current) return;
    const view = editorViewRef.current;
    if (!view) return;

    const source = view.state.doc.toString();
    const cursorOffset = view.state.selection.main.head;
    const mode = indentationModeRef.current;
    formattingRef.current = true;
    setFormatting(true);
    setFormatError(false);

    try {
      const modules = await loadFormatterModules();
      const result = await modules.formatWithCursor(source, {
        parser: formatterParser,
        plugins: formatterParser === "json" ? modules.jsonPlugins : modules.xmlPlugins,
        cursorOffset,
        tabWidth: mode === "tab" ? 2 : Number(mode),
        useTabs: mode === "tab",
        ...(formatterParser === "xml" ? { xmlWhitespaceSensitivity: "preserve" as const } : {}),
      });
      if (editorViewRef.current !== view || view.state.doc.toString() !== source) return;
      if (result.formatted === source) {
        view.focus();
        return;
      }

      const nextCursorOffset = Math.max(0, Math.min(result.cursorOffset, result.formatted.length));
      view.dispatch({
        changes: { from: 0, to: source.length, insert: result.formatted },
        selection: { anchor: nextCursorOffset },
        userEvent: "input.format",
      });
      view.focus();
    } catch {
      setFormatError(true);
    } finally {
      formattingRef.current = false;
      setFormatting(false);
    }
  }, [formatterParser]);

  useEffect(() => {
    const parent = editorHostRef.current;
    if (!parent || formatterParser === null) return;

    const handleFormatRequest = () => {
      void formatCode();
    };
    parent.addEventListener("presentation-text-file-format", handleFormatRequest);
    return () => parent.removeEventListener("presentation-text-file-format", handleFormatRequest);
  }, [formatterParser, formatCode]);

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
            {formatterParser !== null ? (
              <button
                type="button"
                className={styles.toolbarAction}
                data-text-file-action="format"
                aria-label={t("editor.textFileFormatCodeShortcut")}
                title={t("editor.textFileFormatCodeShortcut")}
                disabled={formatting}
                onClick={() => void formatCode()}
              >
                {formatting ? t("editor.textFileFormatting") : t("editor.textFileFormatCode")}
              </button>
            ) : null}
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
        {formatError ? <p className={styles.formatError} role="alert" data-text-file-format-error>{t("editor.textFileFormatFailed")}</p> : null}
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
