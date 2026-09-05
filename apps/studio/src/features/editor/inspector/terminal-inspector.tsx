import type {
  ElementEffect,
  FontResource,
  PowerShowElement,
  TerminalTitleTypography,
  TerminalTypography,
} from "@powershow/document-schema";
import { AUTHORING_ROOT_FONT_SIZE_PX } from "@powershow/theme/element-style-defaults";
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
} from "../rich-text-authoring";
import { RichTextAuthoringControl } from "./rich-text-authoring-control";

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

  const updateTitleTypography = (update: (typography: TerminalTitleTypography | undefined) => TerminalTitleTypography) => {
    onUpdate((current) => current.type === "terminal"
      ? {
          ...current,
          titleTypography: update(current.titleTypography),
        }
      : current);
  };

  const typographyDefaults = resolveEffectiveElementStyleDefaults(element).typography;
  const titleTypographyDefaults = {
    fontSize: 0.8125 * AUTHORING_ROOT_FONT_SIZE_PX,
  };

  return (
    <>
      <div className={styles.inspectorDivider} />

      <InspectorSection title={t("inspector.content")} defaultOpen>
        <div className={styles.field}>
          <span>{t("inspector.titleField")}</span>

          <RichTextAuthoringControl
            content={element.title ?? ""}
            id="terminal-title"
            name="terminalTitle"
            multiline={false}
            visibleMarks={{ bold: true, italic: true, underline: true, code: false }}
            showLineBreak={false}
            placeholder={t("inspector.optional")}
            ariaLabel={t("inspector.titleField")}
            onChange={(content) => onUpdate((current) => current.type === "terminal"
              ? {
                  ...current,
                  title: getTextContentPlainText(content) === "" ? undefined : content,
                }
              : current)}
          />
        </div>

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

              <RichTextAuthoringControl
                content={line.content}
                id={`terminal-${element.id}-line-${index}-content`}
                name={`terminalLineContent_${element.id}_${index}`}
                rows={2}
                visibleMarks={{ bold: true, italic: true, underline: true, code: false }}
                showLineBreak={false}
                ariaLabel={t("inspector.content")}
                onChange={(content) => updateLine(index, (currentLine) => ({
                  ...currentLine,
                  content,
                }))}
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
        <div className={styles.inspectorSectionHeader}>
          <div className={styles.inspectorSectionTitle}>
            <span>{t("inspector.titleField")}</span>
          </div>
        </div>

        <ElementTypographyFields
          typography={element.titleTypography}
          effectiveDefaults={titleTypographyDefaults}
          onUpdateTypography={(update) => updateTitleTypography((current) => {
            const next = update(current);
            return {
              fontFamily: next.fontFamily,
              fontSize: next.fontSize,
              fontWeight: next.fontWeight,
              fontStyle: next.fontStyle,
              lineHeight: next.lineHeight,
              letterSpacing: next.letterSpacing,
              textTransform: next.textTransform,
            };
          })}
          controlPrefix="terminal-title"
          fontResources={fontResources}
          visibleProperties={["fontSize"]}
        />

        <div className={styles.inspectorSectionHeader}>
          <div className={styles.inspectorSectionTitle}>
            <span>{t("inspector.content")}</span>
          </div>
        </div>

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
