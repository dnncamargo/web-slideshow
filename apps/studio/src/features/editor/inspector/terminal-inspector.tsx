import type { ElementEffect, FontResource, PowerShowElement, TerminalTypography } from "@powershow/document-schema";
import { resolveEffectiveElementStyleDefaults } from "@powershow/theme/element-style-defaults";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import { InspectorSection } from "./inspector-section";

import type { TypedInspectorProps } from "./inspector-types";

import { CanonicalDataAppearanceSection, type CanonicalDataStyle } from "./sections/canonical-data-appearance-section";
import { CanonicalElementEffectsSection } from "./sections/canonical-element-effects-section";
import { ElementTypographyFields } from "./sections/element-typography-control";
import {
  getTextContentPlainText,
  reconcileTextContentEdit,
} from "../rich-text-authoring";

type TerminalElement = Extract<PowerShowElement, { type: "terminal" }>;

type TerminalLine = TerminalElement["lines"][number];

// ============================================================
// BEGIN: TERMINAL INSPECTOR
// ============================================================

export function TerminalInspector({
  element,
  onUpdate,
  fontResources = [],
}: TypedInspectorProps<TerminalElement> & { fontResources?: readonly FontResource[] }) {
  const { t } = useStudioI18n();

  const updateStyle = (update: (style: CanonicalDataStyle | undefined) => CanonicalDataStyle) => {
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

  const updateEffect = (update: (effect: ElementEffect | undefined) => ElementEffect) => {
    onUpdate((current) => current.type === "terminal" ? { ...current, effect: update(current.effect) } : current);
  };

  const updateTypography = (update: (typography: TerminalTypography | undefined) => TerminalTypography) => {
    onUpdate((current) => current.type === "terminal"
      ? { ...current, typography: update(current.typography) }
      : current);
  };

  const typographyDefaults = resolveEffectiveElementStyleDefaults(element).typography;

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
            value={element.title === undefined ? "" : getTextContentPlainText(element.title)}
            onChange={(event) => {
              const nextPlainText = event.target.value;

              onUpdate((current) => {
                if (current.type !== "terminal") {
                  return current;
                }

                return {
                  ...current,

                  title: nextPlainText === ""
                    ? undefined
                    : reconcileTextContentEdit(current.title ?? "", nextPlainText),
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
                value={getTextContentPlainText(line.content)}
                onChange={(event) => {
                  const nextPlainText = event.target.value;

                  updateLine(
                    index,

                    (currentLine) => ({
                      ...currentLine,

                      content: reconcileTextContentEdit(currentLine.content, nextPlainText),
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

      <InspectorSection title={t("inspector.typography")}>
        <ElementTypographyFields
          typography={element.typography}
          effectiveDefaults={typographyDefaults!}
          onUpdateTypography={(update) => updateTypography((current) => {
            const next = update(current);
            return {
              fontFamily: next.fontFamily,
              fontSize: next.fontSize,
              lineHeight: next.lineHeight,
              letterSpacing: next.letterSpacing,
            };
          })}
          controlPrefix="terminal"
          fontResources={fontResources}
          visibleProperties={["fontFamily", "fontSize", "lineHeight", "letterSpacing"]}
        />
      </InspectorSection>

      <CanonicalDataAppearanceSection
        element={element}
        style={element.style}
        effect={element.effect}
        onUpdateStyle={updateStyle}
        controlPrefix="terminal"
        onUpdateEffect={updateEffect}
      />

      <CanonicalElementEffectsSection
        effect={element.effect}
        onUpdateEffect={updateEffect}
        controlPrefix="terminal"
      />
    </>
  );
}

// ============================================================
// END: TERMINAL INSPECTOR
// ============================================================
