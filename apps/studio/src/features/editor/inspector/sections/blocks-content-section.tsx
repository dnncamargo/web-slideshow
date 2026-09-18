import { useLayoutEffect, useRef } from "react";
import type { BlocksElement } from "@powershow/document-schema";
import { parseBlocksSource } from "@powershow/renderer";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";
import type { ElementInspectorUpdate } from "../inspector-types";
import { useAuthoringHistory } from "../../authoring-history-context";

interface BlocksContentSectionProps {
  element: BlocksElement;

  onUpdate: ElementInspectorUpdate;

}

export function BlocksContentSection({
  element,
  onUpdate,
}: BlocksContentSectionProps) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const sourceHistoryKey = `text:blocks-${element.id}-source`;
  const textEditMeta = { kind: "text.edit", labelKey: "history.text.edit" } as const;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const parsed = parseBlocksSource(element.source);
  useLayoutEffect(() => {
    if (pendingCaretRef.current === null) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(pendingCaretRef.current, pendingCaretRef.current);
    pendingCaretRef.current = null;
  }, [element.source]);
  const insert = (prefix: string, suffix = ")") => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? element.source.length;
    const end = textarea?.selectionEnd ?? start;
    const selected = element.source.slice(start, end);
    const source = `${element.source.slice(0, start)}${prefix}${selected}${suffix}${element.source.slice(end)}`;
    const caret = start + prefix.length + selected.length;
    pendingCaretRef.current = caret;
    const update = () => onUpdate((current) => current.type === "blocks" ? { ...current, source } : current);
    if (authoringHistory) {
      authoringHistory.discrete(
        { kind: "element.setting", labelKey: "history.element.setting", labelParams: { setting: "blocks.sourceInsert" } },
        update,
      );
    } else {
      update();
    }
    textarea?.focus();
    textarea?.setSelectionRange(caret, caret);
  };
  const tools = [
    ["EV", "\\start(", ")", "inspector.blocks.toolbar.event", "Event / Start block"],
    ["STM", "\\statement(", ")", "inspector.blocks.toolbar.statement", "Statement block"],
    ["SCO", "\\scope(", "){}", "inspector.blocks.toolbar.scope", "Scope block"],
    ["END", "\\end(", ")", "inspector.blocks.toolbar.end", "End block"],
    ["VAL", "\\value(", ")", "inspector.blocks.toolbar.value", "Value block"],
    ["VAR", "\\variable(", ")", "inspector.blocks.toolbar.variable", "Variable"],
    ["01", "\\logic(", ")", "inspector.blocks.toolbar.logic", "Logic block"],
  ] as const;

  return (
    <div data-powershow-blocks-inspector="true">
      <label className={styles.field}>
        <span>{t("inspector.blocks.source")}</span>
        <div className={styles.textEditor}>
          <div className={styles.textEditorToolbar} data-powershow-blocks-toolbar="true">
            {tools.map(([label, prefix, suffix, translationKey, accessibleLabel]) => (
              <button
                key={label}
                type="button"
                className={styles.textEditorToolbarButton}
                aria-label={t(translationKey)}
                title={accessibleLabel}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insert(prefix, suffix)}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            className={styles.textArea}
            value={element.source}
            onFocus={() => authoringHistory?.begin(sourceHistoryKey, textEditMeta)}
            onBlur={() => authoringHistory?.finish(sourceHistoryKey)}
            onChange={(event) => {
              const source = event.target.value;
              if (source === element.source) {
                return;
              }

              authoringHistory?.begin(sourceHistoryKey, textEditMeta);
              const update = () => onUpdate((current) => (
                current.type === "blocks" && current.source !== source
                  ? { ...current, source }
                  : current
              ));

              if (authoringHistory) {
                authoringHistory.update(sourceHistoryKey, update);
              } else {
                update();
              }
            }}
            rows={8}
            data-powershow-blocks-source="true"
          />
        </div>
      </label>
      {parsed.ok ? (
        <div role="status" data-powershow-blocks-syntax="valid" className={styles.fieldHint}>
          {t("inspector.blocks.syntaxValid")}
        </div>
      ) : (
        <div role="alert" data-powershow-blocks-syntax="invalid" className={styles.fieldHint}>
          {t("inspector.blocks.syntaxInvalid", {
            line: parsed.error.line,
            column: parsed.error.column,
            message: parsed.error.message,
          })}
        </div>
      )}
    </div>
  );
}
