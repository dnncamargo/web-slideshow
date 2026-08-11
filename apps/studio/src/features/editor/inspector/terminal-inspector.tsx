import type { PowerShowElement } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import { InspectorSection } from "./inspector-section";

import type {
  TypedInspectorProps,
  UpdateElementStyle,
} from "./inspector-types";

import { ElementAppearanceSection } from "./sections/element-appearance-section";

import { ElementEffectsSection } from "./sections/element-effects-section";

type TerminalElement = Extract<PowerShowElement, { type: "terminal" }>;

type TerminalLine = TerminalElement["lines"][number];

// ============================================================
// BEGIN: TERMINAL INSPECTOR
// ============================================================

export function TerminalInspector({
  element,
  onUpdate,
}: TypedInspectorProps<TerminalElement>) {
  const { t } = useStudioI18n();

  const updateStyle: UpdateElementStyle = (update) => {
    onUpdate((current) => {
      if (current.type !== "terminal") {
        return current;
      }

      return {
        ...current,

        style: update(current.style),
      };
    });
  };

  // ==========================================================
  // BEGIN: UPDATE DE UMA LINHA
  // ==========================================================

  function updateLine(
    index: number,
    update: (line: TerminalLine) => TerminalLine,
  ) {
    onUpdate((current) => {
      if (current.type !== "terminal") {
        return current;
      }

      return {
        ...current,

        lines: current.lines.map((line, lineIndex) =>
          lineIndex === index ? update(line) : line,
        ),
      };
    });
  }

  // ==========================================================
  // END: UPDATE DE UMA LINHA
  // ==========================================================

  function removeLine(index: number) {
    onUpdate((current) => {
      if (current.type !== "terminal") {
        return current;
      }

      return {
        ...current,

        lines: current.lines.filter((_line, lineIndex) => lineIndex !== index),
      };
    });
  }

  // ==========================================================
  // BEGIN: ADICIONAR LINHA
  //
  // TerminalSchema permite uma lista vazia ou múltiplas linhas.
  // A nova linha começa como command.
  // ==========================================================

  function addLine() {
    onUpdate((current) => {
      if (current.type !== "terminal") {
        return current;
      }

      return {
        ...current,

        lines: [
          ...current.lines,

          {
            type: "command",

            content: "New command",
          },
        ],
      };
    });
  }

  // ==========================================================
  // END: ADICIONAR LINHA
  // ==========================================================

  return (
    <>
      <div className={styles.inspectorDivider} />

      <InspectorSection title={t("inspector.content")} defaultOpen>
        <label className={styles.field}>
          <span>{t("inspector.titleField")}</span>

          <input
            id="terminal-title"
            name="terminalTitle"
            type="text"
            placeholder={t("inspector.optional")}
            value={element.title ?? ""}
            onChange={(event) => {
              const value = event.target.value;

              onUpdate((current) => {
                if (current.type !== "terminal") {
                  return current;
                }

                return {
                  ...current,

                  title: value === "" ? undefined : value,
                };
              });
            }}
          />
        </label>

        <div className={styles.inspectorSectionHeader}>
          <div className={styles.inspectorSectionTitle}>
            <span>{t("inspector.lines")}</span>
          </div>

          <span className={styles.sectionCount}>{element.lines.length}</span>
        </div>

        <div className={styles.terminalLines}>
          {element.lines.length === 0 && (
            <div className={styles.emptyInspectorList}>
              <span>{t("inspector.noTerminalLines")}</span>
            </div>
          )}

          {element.lines.map((line, index) => (
            <div key={index} className={styles.terminalLine}>
              <div className={styles.terminalLineHeader}>
                <span className={styles.terminalLineIndex}>{index + 1}</span>

                <select
                  id={`terminal-${element.id}-line-${index}-type`}
                  name={`terminalLineType_${element.id}_${index}`}
                  className={styles.terminalLineType}
                  value={line.type}
                  onChange={(event) => {
                    const type = event.target.value as TerminalLine["type"];

                    updateLine(
                      index,

                      (currentLine) => ({
                        ...currentLine,

                        type,
                      }),
                    );
                  }}
                >
                  <option value="command">{t("inspector.command")}</option>

                  <option value="output">{t("inspector.output")}</option>

                  <option value="comment">{t("inspector.comment")}</option>

                  <option value="error">{t("inspector.error")}</option>
                </select>

                <button
                  type="button"
                  className={styles.iconButtonDanger}
                  aria-label={t("inspector.removeTerminalLine", {
                    number: index + 1,
                  })}
                  title={t("inspector.removeLine")}
                  onClick={() => {
                    removeLine(index);
                  }}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>

              <textarea
                id={`terminal-${element.id}-line-${index}-content`}
                name={`terminalLineContent_${element.id}_${index}`}
                className={styles.textArea}
                rows={2}
                value={line.content}
                onChange={(event) => {
                  const content = event.target.value;

                  updateLine(
                    index,

                    (currentLine) => ({
                      ...currentLine,

                      content,
                    }),
                  );
                }}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          className={styles.secondaryButton}
          onClick={addLine}
        >
          <span>{t("inspector.addLine")}</span>
        </button>
      </InspectorSection>

      <ElementAppearanceSection
        element={element}
        onUpdateStyle={updateStyle}
        controlPrefix="terminal"
        showBackground
        showBackgroundGradient
        showRoundedCorners
        showOpacity
        showBorder
      />

      <ElementEffectsSection
        style={element.style}
        onUpdateStyle={updateStyle}
        controlPrefix="terminal"
      />
    </>
  );
}

// ============================================================
// END: TERMINAL INSPECTOR
// ============================================================
