import { useState } from "react";

import type {
  ContainerElement,
  PowerShowElement,
} from "@powershow/document-schema";

import {
  PANEL_SIZE_PRESETS,
  resolvePanelSize,
} from "@powershow/theme/panel-size";

import type { PanelSizePreset } from "@powershow/theme/panel-size";

import styles from "./editor-workspace.module.css";

// ============================================================
// BEGIN: IMAGE + TABLE INSPECTORS
// ============================================================

import { ImageInspector } from "./image-inspector";

import { TableInspector } from "./table-inspector";

// ============================================================
// END: IMAGE + TABLE INSPECTORS
// ============================================================

// ============================================================
// BEGIN: TIPOS DO INSPECTOR
// ============================================================

interface ElementInspectorProps {
  element: PowerShowElement;

  onUpdate: (update: (element: PowerShowElement) => PowerShowElement) => void;
}

interface TypedInspectorProps<TElement extends PowerShowElement> {
  element: TElement;

  onUpdate: ElementInspectorProps["onUpdate"];
}

type TextElement = Extract<
  PowerShowElement,
  {
    type: "text";
  }
>;

type TextboxElement = Extract<
  PowerShowElement,
  {
    type: "textbox";
  }
>;

type CodeElement = Extract<
  PowerShowElement,
  {
    type: "code";
  }
>;

type TerminalElement = Extract<
  PowerShowElement,
  {
    type: "terminal";
  }
>;

type TerminalLine = TerminalElement["lines"][number];

type PanelSizeSelection = PanelSizePreset | "custom";

// ============================================================
// END: TIPOS DO INSPECTOR
// ============================================================

// ============================================================
// BEGIN: HELPERS DE DIMENSÃO
// ============================================================

function readPercentage(value: string | number | undefined): number | "" {
  if (typeof value !== "string" || !value.endsWith("%")) {
    return "";
  }

  const number = Number(value.slice(0, -1));

  return Number.isFinite(number) ? number : "";
}

function readAbsoluteNumber(value: string | number | undefined): number | "" {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.endsWith("px")) {
    const number = Number(value.slice(0, -2));

    return Number.isFinite(number) ? number : "";
  }

  return "";
}

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === "") {
    return undefined;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : undefined;
}

// ============================================================
// END: HELPERS DE DIMENSÃO
// ============================================================

// ============================================================
// BEGIN: PRESETS DE CONTAINER
// ============================================================

function detectPanelSizePreset(
  container: ContainerElement,
): PanelSizeSelection {
  const width = container.style?.width;

  const height = container.style?.height;

  for (const preset of ["small", "medium", "large", "wide"] as const) {
    const dimensions = PANEL_SIZE_PRESETS[preset];

    if (width === dimensions.width && height === dimensions.height) {
      return preset;
    }
  }

  return "custom";
}

// ============================================================
// END: PRESETS DE CONTAINER
// ============================================================

// ============================================================
// BEGIN: HELPERS DE COR
// ============================================================

const DEFAULT_PICKER_COLOR = "#f8fafc";

function readPickerColor(value: string | undefined): string {
  if (value && /^#[0-9a-fA-F]{6}$/.test(value)) {
    return value;
  }

  return DEFAULT_PICKER_COLOR;
}

// ============================================================
// END: HELPERS DE COR
// ============================================================

// ============================================================
// BEGIN: HELPERS DE CODE
// ============================================================

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
// END: HELPERS DE CODE
// ============================================================

// ============================================================
// BEGIN: CONTAINER INSPECTOR
// ============================================================

function ContainerInspector({
  element,
  onUpdate,
}: TypedInspectorProps<ContainerElement>) {
  function updateContainer(
    update: (container: ContainerElement) => ContainerElement,
  ) {
    onUpdate((current) => {
      if (current.type !== "container") {
        return current;
      }

      return update(current);
    });
  }

  return (
    <>
      <div className={styles.inspectorDivider} />

      <div className={styles.inspectorSectionTitle}>Size</div>

      {/* =====================================================
          BEGIN: PRESET
          ===================================================== */}

      <label className={styles.field}>
        <span>Preset</span>

        <select
          value={detectPanelSizePreset(element)}
          onChange={(event) => {
            const value = event.target.value;

            if (value === "custom") {
              return;
            }

            const preset = value as PanelSizePreset;

            const size = resolvePanelSize(preset);

            updateContainer((container) => ({
              ...container,

              style: {
                ...container.style,

                ...size,
              },
            }));
          }}
        >
          <option value="small">Small</option>

          <option value="medium">Medium</option>

          <option value="large">Large</option>

          <option value="wide">Wide</option>

          <option value="custom">Custom</option>
        </select>
      </label>

      {/* =====================================================
          END: PRESET
          ===================================================== */}

      {/* =====================================================
          BEGIN: WIDTH + HEIGHT
          ===================================================== */}

      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span>Width</span>

          <div className={styles.unitInput}>
            <input
              type="number"
              min="1"
              max="100"
              value={readPercentage(element.style?.width)}
              onChange={(event) => {
                const number = parseOptionalNumber(event.target.value);

                updateContainer((container) => ({
                  ...container,

                  style: {
                    ...container.style,

                    width: number === undefined ? undefined : `${number}%`,
                  },
                }));
              }}
            />

            <span>%</span>
          </div>
        </label>

        <label className={styles.field}>
          <span>Height</span>

          <div className={styles.unitInput}>
            <input
              type="number"
              min="1"
              max="100"
              value={readPercentage(element.style?.height)}
              onChange={(event) => {
                const number = parseOptionalNumber(event.target.value);

                updateContainer((container) => ({
                  ...container,

                  style: {
                    ...container.style,

                    height: number === undefined ? undefined : `${number}%`,
                  },
                }));
              }}
            />

            <span>%</span>
          </div>
        </label>
      </div>

      {/* =====================================================
          END: WIDTH + HEIGHT
          ===================================================== */}

      <div className={styles.inspectorDivider} />

      <div className={styles.inspectorSectionTitle}>Spacing</div>

      {/* =====================================================
          BEGIN: PADDING + GAP
          ===================================================== */}

      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span>Padding</span>

          <div className={styles.unitInput}>
            <input
              type="number"
              min="0"
              value={readAbsoluteNumber(element.style?.padding)}
              onChange={(event) => {
                const number = parseOptionalNumber(event.target.value);

                updateContainer((container) => ({
                  ...container,

                  style: {
                    ...container.style,

                    padding: number,
                  },
                }));
              }}
            />

            <span>px</span>
          </div>
        </label>

        <label className={styles.field}>
          <span>Gap</span>

          <div className={styles.unitInput}>
            <input
              type="number"
              min="0"
              value={readAbsoluteNumber(element.gap)}
              onChange={(event) => {
                const number = parseOptionalNumber(event.target.value);

                updateContainer((container) => ({
                  ...container,

                  gap: number,
                }));
              }}
            />

            <span>px</span>
          </div>
        </label>
      </div>

      {/* =====================================================
          END: PADDING + GAP
          ===================================================== */}
    </>
  );
}

// ============================================================
// END: CONTAINER INSPECTOR
// ============================================================

// ============================================================
// BEGIN: TEXT INSPECTOR
// ============================================================

function TextInspector({
  element,
  onUpdate,
}: TypedInspectorProps<TextElement>) {
  return (
    <>
      <div className={styles.inspectorDivider} />

      <div className={styles.inspectorSectionTitle}>Content</div>

      <label className={styles.field}>
        <span>Text</span>

        <textarea
          className={styles.textArea}
          rows={5}
          value={element.content}
          onChange={(event) => {
            const content = event.target.value;

            onUpdate((current) => {
              if (current.type !== "text") {
                return current;
              }

              return {
                ...current,

                content,
              };
            });
          }}
        />
      </label>

      <label className={styles.field}>
        <span>Style</span>

        <select
          value={element.variant}
          onChange={(event) => {
            const variant = event.target.value as TextElement["variant"];

            onUpdate((current) => {
              if (current.type !== "text") {
                return current;
              }

              return {
                ...current,

                variant,
              };
            });
          }}
        >
          <option value="title">Title</option>

          <option value="subtitle">Subtitle</option>

          <option value="body">Body</option>

          <option value="caption">Caption</option>
        </select>
      </label>

      <div className={styles.inspectorDivider} />

      <div className={styles.inspectorSectionTitle}>Appearance</div>

      <div className={styles.colorControl}>
        <label className={styles.field}>
          <span>Color</span>

          <input
            className={styles.colorInput}
            type="color"
            value={readPickerColor(element.style?.color)}
            onChange={(event) => {
              const color = event.target.value;

              onUpdate((current) => {
                if (current.type !== "text") {
                  return current;
                }

                return {
                  ...current,

                  style: {
                    ...current.style,

                    color,
                  },
                };
              });
            }}
          />
        </label>

        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => {
            onUpdate((current) => {
              if (current.type !== "text") {
                return current;
              }

              return {
                ...current,

                style: {
                  ...current.style,

                  color: undefined,
                },
              };
            });
          }}
        >
          Use theme default
        </button>
      </div>
    </>
  );
}

// ============================================================
// END: TEXT INSPECTOR
// ============================================================

// ============================================================
// BEGIN: TEXTBOX INSPECTOR
// ============================================================

function TextboxInspector({
  element,
  onUpdate,
}: TypedInspectorProps<TextboxElement>) {
  return (
    <>
      <div className={styles.inspectorDivider} />

      <div className={styles.inspectorSectionTitle}>Content</div>

      <label className={styles.field}>
        <span>Text</span>

        <textarea
          className={styles.textArea}
          rows={7}
          value={element.content}
          onChange={(event) => {
            const content = event.target.value;

            onUpdate((current) => {
              if (current.type !== "textbox") {
                return current;
              }

              return {
                ...current,

                content,
              };
            });
          }}
        />
      </label>

      <div className={styles.inspectorDivider} />

      <div className={styles.inspectorSectionTitle}>Appearance</div>

      <div className={styles.colorControl}>
        <label className={styles.field}>
          <span>Color</span>

          <input
            className={styles.colorInput}
            type="color"
            value={readPickerColor(element.style?.color)}
            onChange={(event) => {
              const color = event.target.value;

              onUpdate((current) => {
                if (current.type !== "textbox") {
                  return current;
                }

                return {
                  ...current,

                  style: {
                    ...current.style,

                    color,
                  },
                };
              });
            }}
          />
        </label>

        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => {
            onUpdate((current) => {
              if (current.type !== "textbox") {
                return current;
              }

              return {
                ...current,

                style: {
                  ...current.style,

                  color: undefined,
                },
              };
            });
          }}
        >
          Use theme default
        </button>
      </div>
    </>
  );
}

// ============================================================
// END: TEXTBOX INSPECTOR
// ============================================================

// ============================================================
// BEGIN: CODE INSPECTOR
// ============================================================

function CodeInspector({
  element,
  onUpdate,
}: TypedInspectorProps<CodeElement>) {
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

  return (
    <>
      <div className={styles.inspectorDivider} />

      <div className={styles.inspectorSectionTitle}>Code</div>

      {/* =====================================================
          BEGIN: CÓDIGO
          ===================================================== */}

      <label className={styles.field}>
        <span>Source</span>

        <textarea
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

      {/* =====================================================
          END: CÓDIGO
          ===================================================== */}

      {/* =====================================================
          BEGIN: LINGUAGEM
          ===================================================== */}

      <label className={styles.field}>
        <span>Language</span>

        <input
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

      {/* =====================================================
          END: LINGUAGEM
          ===================================================== */}

      {/* =====================================================
          BEGIN: NÚMEROS DE LINHA
          ===================================================== */}

      <label className={styles.checkboxRow}>
        <input
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

        <span>Show line numbers</span>
      </label>

      {/* =====================================================
          END: NÚMEROS DE LINHA
          ===================================================== */}

      {/* =====================================================
          BEGIN: LINHAS DESTACADAS
          ===================================================== */}

      <label className={styles.field}>
        <span>Highlighted lines</span>

        <input
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
          Separate line numbers with commas.
        </small>
      </label>

      {/* =====================================================
          END: LINHAS DESTACADAS
          ===================================================== */}
    </>
  );
}

// ============================================================
// END: CODE INSPECTOR
// ============================================================

// ============================================================
// BEGIN: TERMINAL INSPECTOR
// ============================================================

function TerminalInspector({
  element,
  onUpdate,
}: TypedInspectorProps<TerminalElement>) {
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

  // ==========================================================
  // BEGIN: REMOVER LINHA
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
  // END: REMOVER LINHA
  // ==========================================================

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

      <div className={styles.inspectorSectionTitle}>Terminal</div>

      {/* =====================================================
          BEGIN: TÍTULO
          ===================================================== */}

      <label className={styles.field}>
        <span>Title</span>

        <input
          type="text"
          placeholder="Optional"
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

      {/* =====================================================
          END: TÍTULO
          ===================================================== */}

      <div className={styles.inspectorDivider} />

      <div className={styles.inspectorSectionHeader}>
        <div className={styles.inspectorSectionTitle}>Lines</div>

        <span className={styles.sectionCount}>{element.lines.length}</span>
      </div>

      {/* =====================================================
          BEGIN: LISTA DE LINHAS
          ===================================================== */}

      <div className={styles.terminalLines}>
        {element.lines.length === 0 && (
          <div className={styles.emptyInspectorList}>No terminal lines.</div>
        )}

        {element.lines.map((line, index) => (
          <div key={index} className={styles.terminalLine}>
            {/* =============================================
                  BEGIN: CABEÇALHO DA LINHA
                  ============================================= */}

            <div className={styles.terminalLineHeader}>
              <span className={styles.terminalLineIndex}>{index + 1}</span>

              <select
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
                <option value="command">Command</option>

                <option value="output">Output</option>

                <option value="comment">Comment</option>

                <option value="error">Error</option>
              </select>

              <button
                type="button"
                className={styles.iconButtonDanger}
                aria-label={`Remove terminal line ${index + 1}`}
                title="Remove line"
                onClick={() => {
                  removeLine(index);
                }}
              >
                ×
              </button>
            </div>

            {/* =============================================
                  END: CABEÇALHO DA LINHA
                  ============================================= */}

            {/* =============================================
                  BEGIN: CONTEÚDO DA LINHA
                  ============================================= */}

            <textarea
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

            {/* =============================================
                  END: CONTEÚDO DA LINHA
                  ============================================= */}
          </div>
        ))}
      </div>

      {/* =====================================================
          END: LISTA DE LINHAS
          ===================================================== */}

      <button
        type="button"
        className={styles.secondaryButton}
        onClick={addLine}
      >
        + Add line
      </button>
    </>
  );
}

// ============================================================
// END: TERMINAL INSPECTOR
// ============================================================

// ============================================================
// BEGIN: ELEMENT INSPECTOR
//
// Este componente agora funciona como dispatcher.
//
// Ele identifica o tipo selecionado e entrega a edição para
// o Inspector específico daquele tipo.
// ============================================================

export function ElementInspector({ element, onUpdate }: ElementInspectorProps) {
  return (
    <>
      {/* =====================================================
          BEGIN: IDENTIFICAÇÃO
          ===================================================== */}

      <div className={styles.inspectorGroup}>
        <span className={styles.inspectorLabel}>Element</span>

        <strong>{element.type}</strong>
      </div>

      <div className={styles.inspectorGroup}>
        <span className={styles.inspectorLabel}>ID</span>

        <code>{element.id}</code>
      </div>

      {/* =====================================================
          END: IDENTIFICAÇÃO
          ===================================================== */}

      {/* =====================================================
          BEGIN: INSPECTORS POR TIPO
          ===================================================== */}

      {element.type === "container" && (
        <ContainerInspector element={element} onUpdate={onUpdate} />
      )}

      {element.type === "text" && (
        <TextInspector element={element} onUpdate={onUpdate} />
      )}

      {element.type === "textbox" && (
        <TextboxInspector element={element} onUpdate={onUpdate} />
      )}

      {element.type === "code" && (
        <CodeInspector key={element.id} element={element} onUpdate={onUpdate} />
      )}

      {element.type === "terminal" && (
        <TerminalInspector element={element} onUpdate={onUpdate} />
      )}

      {/* =====================================================
          END: INSPECTORS POR TIPO
          ===================================================== */}
      {/* =====================================================
          BEGIN: IMAGE + TABLE
          ===================================================== */}

      {element.type === "image" && (
        <ImageInspector element={element} onUpdate={onUpdate} />
      )}

      {element.type === "table" && (
        <TableInspector element={element} onUpdate={onUpdate} />
      )}

      {/* =====================================================
          END: IMAGE + TABLE
          ===================================================== */}

      {/* =====================================================
          BEGIN: TIPOS AINDA NÃO IMPLEMENTADOS
          ===================================================== */}

      {/* ==========================================================
    BEGIN: TIPOS AINDA NÃO IMPLEMENTADOS
    ========================================================== */}

      {element.type !== "container" &&
        element.type !== "text" &&
        element.type !== "textbox" &&
        element.type !== "code" &&
        element.type !== "terminal" &&
        element.type !== "image" &&
        element.type !== "table" && (
          <div className={styles.nextStep}>
            This element is connected to the document. Specific editing controls
            will be added in the next rounds.
          </div>
        )}

      {/* =====================================================
          END: TIPOS AINDA NÃO IMPLEMENTADOS
          ===================================================== */}
    </>
  );
}

// ============================================================
// END: ELEMENT INSPECTOR
// ============================================================
