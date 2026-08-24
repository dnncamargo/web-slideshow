import { useState } from "react";

import type { ElementEffect, PowerShowElement } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import { InspectorSection } from "./inspector-section";

import type { TypedInspectorProps } from "./inspector-types";

import { CanonicalDataAppearanceSection, type CanonicalDataStyle } from "./sections/canonical-data-appearance-section";
import { CanonicalElementEffectsSection } from "./sections/canonical-element-effects-section";

type CodeElement = Extract<PowerShowElement, { type: "code" }>;

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

// ============================================================
// BEGIN: CODE INSPECTOR
// ============================================================

export function CodeInspector({
  element,
  onUpdate,
}: TypedInspectorProps<CodeElement>) {
  const { t } = useStudioI18n();

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

    onUpdate((current) => {
      if (current.type !== "code") {
        return current;
      }

      return {
        ...current,

        highlightedLines,
      };
    });
  }

  const updateEffect = (update: (effect: ElementEffect | undefined) => ElementEffect) => {
    onUpdate((current) => current.type === "code" ? { ...current, effect: update(current.effect) } : current);
  };

  return (
    <>
      <div className={styles.inspectorDivider} />

      <InspectorSection title={t("inspector.content")} defaultOpen>
        <label className={styles.field}>
          <span>{t("inspector.source")}</span>

          <textarea
            id="code-source"
            name="codeSource"
            className={`${styles.textArea} ${styles.codeTextArea}`}
            rows={10}
            spellCheck={false}
            value={element.code}
            onChange={(event) => {
              const code = event.target.value;

              onUpdate((current) => {
                if (current.type !== "code") {
                  return current;
                }

                return {
                  ...current,

                  code,
                };
              });
            }}
          />
        </label>

        <label className={styles.field}>
          <span>{t("inspector.language")}</span>

          <input
            id="code-language"
            name="codeLanguage"
            type="text"
            list="powershow-code-languages"
            value={element.language}
            onChange={(event) => {
              const language = event.target.value;

              onUpdate((current) => {
                if (current.type !== "code") {
                  return current;
                }

                return {
                  ...current,

                  language,
                };
              });
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

              onUpdate((current) => {
                if (current.type !== "code") {
                  return current;
                }

                return {
                  ...current,

                  showLineNumbers,
                };
              });
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

      <CanonicalDataAppearanceSection
        element={element}
        style={element.style}
        effect={element.effect}
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
