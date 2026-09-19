import { useState } from "react";

import type { CodeTypography, ElementEffect, FontResource, PresentationElement } from "@web-slideshow/document-schema";
import { resolveEffectiveElementStyleDefaults } from "@web-slideshow/theme/element-style-defaults";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import { InspectorSection } from "./inspector-section";

import type { TypedInspectorProps } from "./inspector-types";

import { CanonicalDataAppearanceSection, type CanonicalDataStyle } from "./sections/canonical-data-appearance-section";
import { CanonicalElementEffectsSection } from "./sections/canonical-element-effects-section";
import { ElementTypographyFields } from "./sections/element-typography-control";
import { ElementSpacingSection } from "./sections/element-spacing-section";
import { RichTextAuthoringControl } from "./rich-text-authoring-control";
import { useAuthoringHistory } from "../authoring-history-context";

type CodeElement = Extract<PresentationElement, { type: "code" }>;

function formatHighlightedLines(lines: number[]): string {
  return lines.join(", ");
}

function parseHighlightedLines(value: string): number[] {
  const numbers = value
    .split(/[\s,;]+/)
    .map((part) => Number(part))
    .filter((number) => Number.isInteger(number) && number > 0);

  return Array.from(new Set(numbers)).sort((left, right) => left - right);
}

function areHighlightedLinesEqual(left: readonly number[], right: readonly number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

// ============================================================
// BEGIN: CODE INSPECTOR
// ============================================================

export function CodeInspector({
  element,
  onUpdate,
  fontResources = [],
}: TypedInspectorProps<CodeElement> & { fontResources?: readonly FontResource[] }) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const languageHistoryKey = `text:code-${element.id}-language`;
  const textEditMeta = { kind: "text.edit", labelKey: "history.text.edit" } as const;
  const runDiscrete = (callback: () => void): void => {
    const meta = { kind: "element.setting", labelKey: "history.element.setting", labelParams: { setting: "code.showLineNumbers" } } as const;
    if (authoringHistory) authoringHistory.discrete(meta, callback);
    else callback();
  };

  const updateStyle = (update: (style: CanonicalDataStyle | undefined) => CanonicalDataStyle) => {
    onUpdate((current) => {
      if (current.type !== "code") {
        return current;
      }

      return {
        ...current,

        style: update(current.style),
      };
    });
  };

  // ----------------------------------------------------------
  // Mantemos a string localmente enquanto o usuário digita.
  //
  // Assim é possível escrever naturalmente:
  //
  // 1, 3, 5
  //
  // sem o campo ser reformatado a cada tecla.
  // ----------------------------------------------------------

  const [highlightedLinesInput, setHighlightedLinesInput] = useState(() =>
    formatHighlightedLines(element.highlightedLines),
  );

  function commitHighlightedLines() {
    const highlightedLines = parseHighlightedLines(highlightedLinesInput);

    setHighlightedLinesInput(formatHighlightedLines(highlightedLines));

    if (areHighlightedLinesEqual(element.highlightedLines, highlightedLines)) {
      return;
    }

    const update = () => onUpdate((current) => {
      if (current.type !== "code" || areHighlightedLinesEqual(current.highlightedLines, highlightedLines)) {
        return current;
      }

      return { ...current, highlightedLines };
    });
    const meta = {
      kind: "element.setting",
      labelKey: "history.element.setting",
      labelParams: { setting: "code.highlightedLines" },
    } as const;

    if (authoringHistory) {
      authoringHistory.discrete(meta, update);
    } else {
      update();
    }
  }

  const updateEffect = (update: (effect: ElementEffect | undefined) => ElementEffect) => {
    onUpdate((current) => current.type === "code" ? { ...current, effect: update(current.effect) } : current);
  };

  const updateTypography = (update: (typography: CodeTypography | undefined) => CodeTypography) => {
    onUpdate((current) => {
      if (current.type !== "code") {
        return current;
      }

      return { ...current, typography: update(current.typography) };
    });
  };

  const typographyDefaults = resolveEffectiveElementStyleDefaults(element).typography;

  return (
    <>
      <div className={styles.inspectorDivider} />

      <InspectorSection title={t("inspector.content")} defaultOpen>
        <div className={styles.field}>
          <span>{t("inspector.source")}</span>

          <RichTextAuthoringControl
            content={element.code}
            historyKey={`element:${element.id}:code`}
            id="code-source"
            name="codeSource"
            rows={10}
            inputClassName={styles.codeTextArea}
            spellCheck={false}
            visibleMarks={{
              bold: true,
              italic: true,
              underline: true,
              code: false,
            }}
            showLineBreak={false}
            ariaLabel={t("inspector.source")}
            onChange={(code) => onUpdate((current) => current.type === "code"
              ? { ...current, code }
              : current)}
          />
        </div>

        <label className={styles.field}>
          <span>{t("inspector.language")}</span>

          <input
            id="code-language"
            name="codeLanguage"
            type="text"
            list="powershow-code-languages"
            value={element.language}
            onFocus={() => authoringHistory?.begin(languageHistoryKey, textEditMeta)}
            onBlur={() => authoringHistory?.finish(languageHistoryKey)}
            onChange={(event) => {
              const language = event.target.value;
              if (language === element.language) {
                return;
              }

              authoringHistory?.begin(languageHistoryKey, textEditMeta);
              const update = () => onUpdate((current) => {
                if (current.type !== "code" || current.language === language) {
                  return current;
                }

                return {
                  ...current,

                  language,
                };
              });

              if (authoringHistory) {
                authoringHistory.update(languageHistoryKey, update);
              } else {
                update();
              }
            }}
          />

          <datalist id="powershow-code-languages">
            <option value="text" />
            <option value="typescript" />
            <option value="javascript" />
            <option value="python" />
            <option value="html" />
            <option value="css" />
            <option value="json" />
            <option value="bash" />
            <option value="powershell" />
            <option value="c" />
            <option value="cpp" />
            <option value="java" />
          </datalist>
        </label>
      </InspectorSection>

      <InspectorSection title={t("inspector.display")}>
        <label className={styles.checkboxRow}>
          <input
            id="code-show-line-numbers"
            name="codeShowLineNumbers"
            type="checkbox"
            checked={element.showLineNumbers}
            onChange={(event) => {
              const showLineNumbers = event.target.checked;
              if (showLineNumbers === element.showLineNumbers) return;
              runDiscrete(() => onUpdate((current) => current.type === "code" ? { ...current, showLineNumbers } : current));
            }}
          />

          <span>{t("inspector.showLineNumbers")}</span>
        </label>

        <label className={styles.field}>
          <span>{t("inspector.highlightedLines")}</span>

          <input
            id="code-highlighted-lines"
            name="codeHighlightedLines"
            type="text"
            placeholder="1, 3, 5"
            value={highlightedLinesInput}
            onChange={(event) => {
              setHighlightedLinesInput(event.target.value);
            }}
            onBlur={commitHighlightedLines}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
          />

          <small className={styles.fieldHint}>
            <span>{t("inspector.highlightedLinesHint")}</span>
          </small>
        </label>
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
          controlPrefix="code"
          fontResources={fontResources}
          visibleProperties={["fontFamily", "fontSize", "lineHeight", "letterSpacing"]}
        />
      </InspectorSection>

      <ElementSpacingSection
        layout={element.layout}
        controlPrefix="code"
        onUpdateLayout={(update) => {
          onUpdate((current) => current.type === "code"
            ? { ...current, layout: update(current.layout) }
            : current);
        }}
      />

      <CanonicalDataAppearanceSection
        element={element}
        style={element.style}
        effect={element.effect}
        showColor
        onUpdateStyle={updateStyle}
        controlPrefix="code"
        onUpdateEffect={updateEffect}
      />

      <CanonicalElementEffectsSection
        effect={element.effect}
        onUpdateEffect={updateEffect}
        controlPrefix="code"
      />
    </>
  );
}

// ============================================================
// END: CODE INSPECTOR
// ============================================================
