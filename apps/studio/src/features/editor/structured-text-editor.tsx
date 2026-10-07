"use client";

import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import {
  highlightSelectionMatches,
  openSearchPanel,
  search,
  searchKeymap,
} from "@codemirror/search";
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Plugin } from "prettier";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "./structured-text-editor.module.css";

export type StructuredTextEditorProfile = "plain" | "json" | "xml" | "html" | "css" | "javascript";

type IndentationMode = "2" | "4" | "tab";
type FormatterParser = "json-stringify" | "xml" | "html" | "css" | "babel";

interface FormatterModules {
  formatWithCursor: typeof import("prettier/standalone").formatWithCursor;
  jsonPlugins: Plugin[];
  xmlPlugins: Plugin[];
  htmlPlugins: Plugin[];
  cssPlugins: Plugin[];
  javascriptPlugins: Plugin[];
}

let formatterModulesPromise: Promise<FormatterModules> | null = null;

function loadFormatterModules(): Promise<FormatterModules> {
  formatterModulesPromise ??= Promise.all([
    import("prettier/standalone"),
    import("prettier/plugins/babel"),
    import("prettier/plugins/estree"),
    import("prettier/plugins/html"),
    import("prettier/plugins/postcss"),
    import("@prettier/plugin-xml"),
  ]).then(([prettier, babel, estree, html, postcss, xml]) => ({
    formatWithCursor: prettier.formatWithCursor,
    jsonPlugins: [babel, estree],
    xmlPlugins: [xml.default],
    htmlPlugins: [html, estree],
    cssPlugins: [postcss],
    javascriptPlugins: [babel, estree],
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

function getEditorLanguage(profile: StructuredTextEditorProfile): Extension {
  if (profile === "json") return json();
  if (profile === "xml") return xml();
  if (profile === "html") return html();
  if (profile === "css") return css();
  if (profile === "javascript") return javascript();
  return [];
}

function getFormatterParser(profile: StructuredTextEditorProfile): FormatterParser | null {
  if (profile === "json") return "json-stringify";
  if (profile === "xml") return "xml";
  if (profile === "html") return "html";
  if (profile === "css") return "css";
  if (profile === "javascript") return "babel";
  return null;
}

function getFormatterPlugins(
  modules: FormatterModules,
  parser: FormatterParser,
): Plugin[] {
  if (parser === "json-stringify") return modules.jsonPlugins;
  if (parser === "xml") return modules.xmlPlugins;
  if (parser === "html") return modules.htmlPlugins;
  if (parser === "css") return modules.cssPlugins;
  return modules.javascriptPlugins;
}

export interface StructuredTextEditorProps {
  title: string;
  baseline: string;
  profile: StructuredTextEditorProfile;
  ariaLabel: string;
  onSave: (content: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  onExit: () => void;
}

export function StructuredTextEditor({
  title,
  baseline,
  profile,
  ariaLabel,
  onSave,
  onDirtyChange,
  onExit,
}: StructuredTextEditorProps) {
  const { t } = useStudioI18n();
  const [draft, setDraft] = useState(baseline);
  const [acceptedBaseline, setAcceptedBaseline] = useState(baseline);
  const [indentationMode, setIndentationMode] = useState<IndentationMode>("2");
  const [formatting, setFormatting] = useState(false);
  const [formatError, setFormatError] = useState(false);
  const editorHostRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const indentationCompartmentRef = useRef(new Compartment());
  const initialContentRef = useRef(baseline);
  const formattingRef = useRef(false);
  const indentationModeRef = useRef(indentationMode);
  const formatterParser = getFormatterParser(profile);
  const languageExtension = useMemo(() => getEditorLanguage(profile), [profile]);
  const formatKeymap = useMemo(() => formatterParser === null ? [] : [{
    key: "Alt-Shift-f",
    run: (view: EditorView) => {
      view.dom.dispatchEvent(new Event("structured-text-editor-format", { bubbles: true }));
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
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    search(),
    highlightSelectionMatches(),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
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
  const dirty = draft !== acceptedBaseline;

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

    view.setState(createEditorState(acceptedBaseline, indentationMode));
    setDraft(acceptedBaseline);
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
        plugins: getFormatterPlugins(modules, formatterParser),
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
    parent.addEventListener("structured-text-editor-format", handleFormatRequest);
    return () => parent.removeEventListener("structured-text-editor-format", handleFormatRequest);
  }, [formatterParser, formatCode]);

  return (
    <section className={styles.editorArea} data-text-file-editor-region data-structured-text-editor>
      <div className={styles.editorToolbar}>
        <span className={styles.editorToolbarTitle}>{title}</span>
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
            data-text-file-action="search"
            aria-label={t("editor.textFileSearchShortcut")}
            title={t("editor.textFileSearchShortcut")}
            onClick={() => {
              const view = editorViewRef.current;
              if (view) openSearchPanel(view);
            }}
          >
            {t("editor.textFileSearch")}
          </button>
          <button
            type="button"
            className={styles.toolbarAction}
            data-text-file-action="save"
            onClick={() => {
              const content = getCurrentDraft();
              if (content !== acceptedBaseline) {
                onSave(content);
                setAcceptedBaseline(content);
              }
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
        aria-label={ariaLabel}
      />
    </section>
  );
}
