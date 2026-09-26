import { useRef, useState } from "react";

import type {
  FontResource,
  ContainerElement,
  Presentation,
  ElementEffect,
  PresentationElement,
  SimpleTableElement,
  StructuredTableElement,
} from "@web-slideshow/document-schema";
import { THEME_COLORS } from "@web-slideshow/theme/element-style-defaults";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import { DangerConfirmDialog } from "@/features/app/danger-confirm-dialog";

import styles from "../editor-workspace.module.css";

import { InspectorSection } from "./inspector-section";
import { useAuthoringHistory } from "../authoring-history-context";

import type {
  TableAuthoringControls,
} from "./inspector-types";

import { CanonicalDataAppearanceSection, type CanonicalDataStyle } from "./sections/canonical-data-appearance-section";
import { CanonicalElementEffectsSection } from "./sections/canonical-element-effects-section";
import { CanonicalElementSizeSection } from "./sections/canonical-element-size-section";
import { ElementTypographyFields, type CoreTypographyProperty } from "./sections/element-typography-control";
import { ElementSpacingSection } from "./sections/element-spacing-section";
import {
  getTextContentPlainText,
  reconcileTextContentEdit,
} from "../rich-text-authoring";
import {
  getStructuredColumnLabel,
  getStructuredRowLabel,
  type TableStructuralSelection,
} from "../table-tree-helpers";
import { resolveNearestContainerColor, type InheritedColorSource } from "./color-inheritance";
import { TargetLinkedStyleSection } from "./sections/target-linked-style-section";
import { inspectTargetLinkedStyle } from "./linked-style-inspector";

// ============================================================
// BEGIN: TIPOS DO TABLE INSPECTOR
// ============================================================

type TableElement = Extract<
  PresentationElement,
  {
    type: "table";
  }
>;

type TableColumn = SimpleTableElement["columns"][number];

type TableRow = SimpleTableElement["rows"][number];

type TableCellValue = TableRow[string];

interface TableInspectorProps {
  element: TableElement;

  onUpdate: (update: (element: PresentationElement) => PresentationElement) => void;

  tableAuthoringControls: TableAuthoringControls;

  fontResources?: readonly FontResource[];

  selectedTableStructuralNode?: TableStructuralSelection;

  onSelectTableStructuralNode?: (selection: TableStructuralSelection) => void;

  presentation?: Pick<Presentation, "linkedStyles">;

  onAttachLinkedStyle?: (id: string) => void;

  onDetachLinkedStyle?: () => void;

  parent?: ContainerElement | null;

  ancestorContainers?: readonly ContainerElement[];
}

// ============================================================
// END: TIPOS DO TABLE INSPECTOR
// ============================================================

// ============================================================
// BEGIN: HELPERS DE TABLE
// ============================================================

function createUniqueColumnKey(columns: TableColumn[]): string {
  let index = 1;

  while (columns.some((column) => column.key === `column_${index}`)) {
    index += 1;
  }

  return `column_${index}`;
}

function getCellType(
  value: TableCellValue | undefined,
): "string" | "number" | "boolean" | "null" {
  if (value === null) {
    return "null";
  }

  if (typeof value === "number") {
    return "number";
  }

  if (typeof value === "boolean") {
    return "boolean";
  }

  return "string";
}

function convertCellType(
  value: TableCellValue | undefined,

  type: "string" | "number" | "boolean" | "null",
): TableCellValue {
  switch (type) {
    case "number": {
      if (typeof value === "number") {
        return value;
      }

      const converted = Number(
        value !== null && (typeof value === "string" || typeof value === "object")
          ? getTextContentPlainText(value)
          : value,
      );

      return Number.isFinite(converted) ? converted : 0;
    }

    case "boolean":
      return typeof value === "boolean" ? value : false;

    case "null":
      return null;

    case "string":
    default:
      if (value === undefined || value === null) {
        return "";
      }

      if (typeof value === "object") {
        return value;
      }

      return String(value);
  }
}

// ============================================================
// END: HELPERS DE TABLE
// ============================================================

// ============================================================
// BEGIN: COLUMN KEY INPUT
//
// A key é estrutural.
//
// Mantemos um draft local enquanto o usuário digita e somente
// alteramos o documento no blur/Enter.
//
// Não precisamos de useEffect para sincronizar currentKey.
// Quando a coluna muda de identidade, React recria este
// componente através de sua key.
// ============================================================

interface ColumnKeyInputProps {
  inputId: string;

  inputName: string;

  currentKey: string;

  existingKeys: string[];

  onCommit: (newKey: string) => void;
}

function ColumnKeyInput({
  inputId,
  inputName,
  currentKey,
  existingKeys,
  onCommit,
}: ColumnKeyInputProps) {
  const [draft, setDraft] = useState(currentKey);
  const skipNextCommitRef = useRef(false);

  function commit() {
    if (skipNextCommitRef.current) {
      skipNextCommitRef.current = false;

      return;
    }

    const value = draft.trim();

    const duplicate = existingKeys.some(
      (key) => key === value && key !== currentKey,
    );

    if (!value || duplicate) {
      setDraft(currentKey);

      return;
    }

    if (value !== currentKey) {
      onCommit(value);
    }
  }

  return (
    <input
      id={inputId}
      name={inputName}
      type="text"
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }

        if (event.key === "Escape") {
          skipNextCommitRef.current = true;
          setDraft(currentKey);

          event.currentTarget.blur();
        }
      }}
    />
  );
}

// ============================================================
// END: COLUMN KEY INPUT
// ============================================================

// ============================================================
// BEGIN: TABLE CELL EDITOR
//
// Diferentemente de uma planilha simples, o schema preserva
// tipos escalares.
//
// Portanto:
//
// string
// number
// boolean
// null
//
// continuam distintos.
// ============================================================

interface TableCellEditorProps {
  controlIdPrefix: string;

  controlNamePrefix: string;

  textHistoryKey: string;

  numberHistoryKey: string;

  value: TableCellValue | undefined;

  onChange: (value: TableCellValue) => void;
}

function TableCellEditor({
  controlIdPrefix,
  controlNamePrefix,
  textHistoryKey,
  numberHistoryKey,
  value,
  onChange,
}: TableCellEditorProps) {
  const type = getCellType(value);
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const textEditMeta = { kind: "text.edit", labelKey: "history.text.edit" } as const;
  const numberChangeMeta = { kind: "number.change", labelKey: "history.number.change" } as const;
  const runDiscrete = (setting: "table.cellType" | "table.cellBoolean", callback: () => void): void => {
    if (authoringHistory) {
      authoringHistory.discrete(
        { kind: "element.setting", labelKey: "history.element.setting", labelParams: { setting } },
        callback,
      );
    } else {
      callback();
    }
  };
  const updateTextValue = (nextPlainText: string): void => {
    const currentPlainText = value === null || value === undefined || (typeof value !== "string" && typeof value !== "object")
      ? ""
      : getTextContentPlainText(value);

    if (nextPlainText === currentPlainText) {
      return;
    }

    const update = () => onChange(
      reconcileTextContentEdit(
        value !== null && (typeof value === "string" || typeof value === "object") ? value : "",
        nextPlainText,
      ),
    );

    if (!authoringHistory) {
      update();
      return;
    }

    authoringHistory.begin(textHistoryKey, textEditMeta);
    authoringHistory.update(textHistoryKey, update);
  };
  const updateNumberValue = (rawValue: string): void => {
    const number = Number(rawValue);
    const nextNumber = Number.isFinite(number) ? number : 0;

    if (nextNumber === value) {
      return;
    }

    const update = () => onChange(nextNumber);

    if (!authoringHistory) {
      update();
      return;
    }

    authoringHistory.begin(numberHistoryKey, numberChangeMeta);
    authoringHistory.update(numberHistoryKey, update);
  };

  return (
    <div className={styles.tableCellEditor}>
      <select
        id={`${controlIdPrefix}-type`}
        name={`${controlNamePrefix}Type`}
        className={`${styles.inspectorControl} ${styles.tableCellType}`}
        value={type}
        onChange={(event) => {
          const nextType = event.target.value as "string" | "number" | "boolean" | "null";
          if (nextType === type) return;
          runDiscrete("table.cellType", () => onChange(convertCellType(value, nextType)));
        }}
      >
        <option value="string">{t("table.text")}</option>

        <option value="number">{t("table.number")}</option>

        <option value="boolean">{t("table.boolean")}</option>

        <option value="null">{t("table.null")}</option>
      </select>

      {type === "string" && (
        <input
          id={`${controlIdPrefix}-value`}
          name={`${controlNamePrefix}Value`}
          type="text"
          className={styles.inspectorControl}
          value={value === undefined || value === null || (typeof value !== "string" && typeof value !== "object")
            ? ""
            : getTextContentPlainText(value)}
          onFocus={() => authoringHistory?.begin(textHistoryKey, textEditMeta)}
          onBlur={() => authoringHistory?.finish(textHistoryKey)}
          onChange={(event) => {
            updateTextValue(event.target.value);
          }}
        />
      )}

      {type === "number" && (
        <input
          id={`${controlIdPrefix}-value`}
          name={`${controlNamePrefix}Value`}
          type="number"
          className={styles.inspectorControl}
          value={typeof value === "number" ? value : 0}
          onFocus={() => authoringHistory?.begin(numberHistoryKey, numberChangeMeta)}
          onBlur={() => authoringHistory?.finish(numberHistoryKey)}
          onChange={(event) => {
            updateNumberValue(event.target.value);
          }}
        />
      )}

      {type === "boolean" && (
        <select
          id={`${controlIdPrefix}-value`}
          name={`${controlNamePrefix}Value`}
          className={styles.inspectorControl}
          value={value === true ? "true" : "false"}
          onChange={(event) => {
            const nextValue = event.target.value === "true";
            if (nextValue === value) return;
            runDiscrete("table.cellBoolean", () => onChange(nextValue));
          }}
        >
          <option value="true">{t("table.true")}</option>

          <option value="false">{t("table.false")}</option>
        </select>
      )}

      {type === "null" && (
        <div className={styles.tableNullValue}>
          <span>null</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// END: TABLE CELL EDITOR
// ============================================================

// ============================================================
// BEGIN: TABLE INSPECTOR
//
// Dispatcher between the legacy Simple Table Inspector and the
// minimal Structured Table Inspector.
// ============================================================

export function TableInspector({
  element,
  onUpdate,
  fontResources = [],
  tableAuthoringControls,
  selectedTableStructuralNode,
  onSelectTableStructuralNode,
  presentation,
  onAttachLinkedStyle,
  onDetachLinkedStyle,
  parent = null,
  ancestorContainers,
}: TableInspectorProps) {
  if (element.mode !== "structured") {
    return <SimpleTableInspector element={element} onUpdate={onUpdate} fontResources={fontResources} presentation={presentation} onAttachLinkedStyle={onAttachLinkedStyle} onDetachLinkedStyle={onDetachLinkedStyle} parent={parent} ancestorContainers={ancestorContainers} />;
  }

  return (
    <StructuredTableInspector
      element={element}
      onUpdate={onUpdate}
      tableAuthoringControls={tableAuthoringControls}
      selectedTableStructuralNode={selectedTableStructuralNode}
      onSelectTableStructuralNode={onSelectTableStructuralNode}
      presentation={presentation}
      onAttachLinkedStyle={onAttachLinkedStyle}
      onDetachLinkedStyle={onDetachLinkedStyle}
    />
  );
}

function SimpleTableInspector({
  element,
  onUpdate,
  fontResources,
  presentation,
  parent,
  ancestorContainers,
  onAttachLinkedStyle,
  onDetachLinkedStyle,
}: {
  element: SimpleTableElement;

  onUpdate: (update: (element: PresentationElement) => PresentationElement) => void;

  fontResources: readonly FontResource[];
  presentation?: Pick<Presentation, "linkedStyles">;
  parent?: ContainerElement | null;
  ancestorContainers?: readonly ContainerElement[];
  onAttachLinkedStyle?: (id: string) => void;
  onDetachLinkedStyle?: () => void;
}) {
  const { t } = useStudioI18n();
  const inheritedContainerColor = resolveNearestContainerColor(
    presentation,
    ancestorContainers !== undefined && ancestorContainers.length > 0
      ? ancestorContainers
      : parent ? [parent] : [],
  );
  const effectiveTableColor = inheritedContainerColor ?? THEME_COLORS.textSecondary;
  const effectiveTableColorSource: InheritedColorSource = inheritedContainerColor === undefined ? "theme" : "container";
  const linkedInspection = inspectTargetLinkedStyle(presentation, element);
  const resolved = linkedInspection.resolved as { layout?: typeof element.layout; style?: CanonicalDataStyle; typography?: SimpleTableElement["typography"]; effect?: ElementEffect } | undefined;
  const property = linkedInspection.getProperty;
  const disabledLayout = (["width", "height", "margin", "marginTop", "marginRight", "marginBottom", "marginLeft"] as const).filter((field) => property(`layout.${field}` as never).owned);
  const disabledTypography = (["fontFamily", "fontSize", "lineHeight"] as const).filter((field) => property(`typography.${field}` as never).owned) as CoreTypographyProperty[];
  const disabledAppearance = (["color", "background.color", "background.gradient", "borderRadius", "border", "opacity"] as const).filter((field) => property((field === "opacity" ? "effect.opacity" : `style.${field}`) as never).owned);
  const authoringHistory = useAuthoringHistory();
  const textEditMeta = { kind: "text.edit", labelKey: "history.text.edit" } as const;

  // ==========================================================
  // BEGIN: UPDATE GENÉRICO DE TABLE
  // ==========================================================

  function updateTable(
    update: (table: SimpleTableElement) => SimpleTableElement,
  ) {
    onUpdate((current) => {
      if (current.type !== "table" || current.mode === "structured") {
        return current;
      }

      return update(current);
    });
  }

  const updateStyle = (update: (style: CanonicalDataStyle | undefined) => CanonicalDataStyle) => {
    updateTable((table) => ({
      ...table,

      style: update(table.style),
    }));
  };

  const updateEffect = (update: (effect: ElementEffect | undefined) => ElementEffect) => {
    updateTable((table) => ({ ...table, effect: update(table.effect) }));
  };

  const updateTypography = (update: (typography: SimpleTableElement["typography"]) => SimpleTableElement["typography"]) => {
    updateTable((table) => ({ ...table, typography: update(table.typography) }));
  };

  // ==========================================================
  // END: UPDATE GENÉRICO DE TABLE
  // ==========================================================

  // ==========================================================
  // BEGIN: RENOMEAR KEY DE COLUNA
  //
  // Quando a key muda, os valores existentes nas rows são
  // migrados para a nova key.
  // ==========================================================

  function renameColumn(index: number, expectedOldKey: string, newKey: string) {
    const update = () => updateTable((table) => {
      const column = table.columns[index];

      if (
        !column
        || column.key !== expectedOldKey
        || !newKey
        || table.columns.some((currentColumn, columnIndex) =>
          columnIndex !== index && currentColumn.key === newKey,
        )
      ) {
        return table;
      }

      const oldKey = column.key;

      if (oldKey === newKey) {
        return table;
      }

      const columns = table.columns.map((currentColumn, columnIndex) =>
        columnIndex === index
          ? {
              ...currentColumn,

              key: newKey,
            }
          : currentColumn,
      );

      const rows = table.rows.map((row) => {
        const nextRow: TableRow = {
          ...row,
        };

        const value = nextRow[oldKey];

        delete nextRow[oldKey];

        nextRow[newKey] = value ?? "";

        return nextRow;
      });

      return {
        ...table,

        columns,
        rows,
      };
    });

    if (authoringHistory) {
      authoringHistory.discrete(
        {
          kind: "element.setting",
          labelKey: "history.element.setting",
          labelParams: { setting: "table.columnKey" },
        },
        update,
      );
    } else {
      update();
    }
  }

  // ==========================================================
  // END: RENOMEAR KEY DE COLUNA
  // ==========================================================

  // ==========================================================
  // BEGIN: ADICIONAR COLUNA
  // ==========================================================

  function addColumn() {
    const update = () => updateTable((table) => {
      const key = createUniqueColumnKey(table.columns);

      return {
        ...table,

        columns: [
          ...table.columns,

          {
            key,

            label: "New column",
          },
        ],

        rows: table.rows.map((row) => ({
          ...row,

          [key]: "",
        })),
      };
    });

    if (authoringHistory) {
      authoringHistory.discrete(
        {
          kind: "table.addColumn",
          labelKey: "history.element.setting",
          labelParams: { setting: "table.addColumn" },
        },
        update,
      );
    } else {
      update();
    }
  }

  // ==========================================================
  // END: ADICIONAR COLUNA
  // ==========================================================

  // ==========================================================
  // BEGIN: REMOVER COLUNA
  // ==========================================================

  function removeColumn(index: number, expectedKey: string) {
    const update = () => updateTable((table) => {
      const column = table.columns[index];

      if (!column || column.key !== expectedKey) {
        return table;
      }

      const key = column.key;

      return {
        ...table,

        columns: table.columns.filter(
          (_column, columnIndex) => columnIndex !== index,
        ),

        rows: table.rows.map((row) => {
          const nextRow: TableRow = {
            ...row,
          };

          delete nextRow[key];

          return nextRow;
        }),
      };
    });

    if (authoringHistory) {
      authoringHistory.discrete(
        {
          kind: "table.removeColumn",
          labelKey: "history.element.setting",
          labelParams: { setting: "table.removeColumn" },
        },
        update,
      );
    } else {
      update();
    }
  }

  // ==========================================================
  // END: REMOVER COLUNA
  // ==========================================================

  // ==========================================================
  // BEGIN: ADICIONAR LINHA
  // ==========================================================

  function addRow() {
    const update = () => updateTable((table) => {
      const row: TableRow = {};

      for (const column of table.columns) {
        row[column.key] = "";
      }

      return {
        ...table,

        rows: [...table.rows, row],
      };
    });

    if (authoringHistory) {
      authoringHistory.discrete(
        {
          kind: "table.addRow",
          labelKey: "history.element.setting",
          labelParams: { setting: "table.addRow" },
        },
        update,
      );
    } else {
      update();
    }
  }

  // ==========================================================
  // END: ADICIONAR LINHA
  // ==========================================================

  // ==========================================================
  // BEGIN: REMOVER LINHA
  // ==========================================================

  function removeRow(index: number) {
    const update = () => updateTable((table) => {
      if (index < 0 || index >= table.rows.length) {
        return table;
      }

      return {
        ...table,

        rows: table.rows.filter((_row, rowIndex) => rowIndex !== index),
      };
    });

    if (authoringHistory) {
      authoringHistory.discrete(
        {
          kind: "table.removeRow",
          labelKey: "history.element.setting",
          labelParams: { setting: "table.removeRow" },
        },
        update,
      );
    } else {
      update();
    }
  }

  // ==========================================================
  // END: REMOVER LINHA
  // ==========================================================

  // ==========================================================
  // BEGIN: ATUALIZAR CÉLULA
  // ==========================================================

  function updateCell(
    rowIndex: number,
    columnKey: string,
    value: TableCellValue,
  ) {
    updateTable((table) => ({
      ...table,

      rows: table.rows.map((row, index) =>
        index === rowIndex
          ? {
              ...row,

              [columnKey]: value,
            }
          : row,
      ),
    }));
  }

  function updateColumnLabel(columnKey: string, nextPlainText: string) {
    const column = element.columns.find((currentColumn) => currentColumn.key === columnKey);

    if (!column || getTextContentPlainText(column.label) === nextPlainText) {
      return;
    }

    const historyKey = `text:table-${element.id}-column-${columnKey}-label`;
    const update = () => updateTable((table) => ({
      ...table,

      columns: table.columns.map((currentColumn) =>
        currentColumn.key === columnKey
          ? {
              ...currentColumn,

              label: reconcileTextContentEdit(currentColumn.label, nextPlainText),
            }
          : currentColumn,
      ),
    }));

    if (!authoringHistory) {
      update();
      return;
    }

    authoringHistory.begin(historyKey, textEditMeta);
    authoringHistory.update(historyKey, update);
  }

  // ==========================================================
  // END: ATUALIZAR CÉLULA
  // ==========================================================

  return (
    <>
      <div className={styles.inspectorDivider} />

      {presentation && onAttachLinkedStyle && onDetachLinkedStyle ? <TargetLinkedStyleSection element={element} presentation={presentation} onAttach={onAttachLinkedStyle} onDetach={onDetachLinkedStyle} /> : null}

      <InspectorSection
        title={t("table.columns")}
        count={element.columns.length}
        defaultOpen
      >
        {/* =====================================================
            BEGIN: COLUMNS
            ===================================================== */}

      <div className={styles.tableEditorList}>
        {element.columns.map((column, index) => (
          <div key={column.key} className={styles.tableColumnEditor}>
            <div className={styles.tableEditorHeader}>
              <strong>
                <span>{t("table.column", { number: index + 1 })}</span>
              </strong>

              <button
                type="button"
                className={styles.iconButtonDanger}
                aria-label={t("table.removeColumn", { number: index + 1 })}
                onClick={() => {
                  removeColumn(index, column.key);
                }}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <label className={styles.field}>
              <span>{t("table.label")}</span>

              <input
                id={`table-${element.id}-column-${column.key}-label`}
                name={`tableColumnLabel_${element.id}_${column.key}`}
                type="text"
                value={getTextContentPlainText(column.label)}
                onFocus={() => authoringHistory?.begin(
                  `text:table-${element.id}-column-${column.key}-label`,
                  textEditMeta,
                )}
                onBlur={() => authoringHistory?.finish(
                  `text:table-${element.id}-column-${column.key}-label`,
                )}
                onChange={(event) => {
                  updateColumnLabel(column.key, event.target.value);
                }}
              />
            </label>

            <label className={styles.field}>
              <span>{t("table.key")}</span>
              {/* ==========================================================
    BEGIN: COLUMN KEY EDITOR

    A key React acompanha a própria key estrutural da coluna.
    Se ela for renomeada, ColumnKeyInput é recriado e seu
    draft começa naturalmente com o novo valor.
    ========================================================== */}
              <ColumnKeyInput
                key={column.key}
                inputId={`table-${element.id}-column-${column.key}-key`}
                inputName={`tableColumnKey_${element.id}_${column.key}`}
                currentKey={column.key}
                existingKeys={element.columns.map((item) => item.key)}
                onCommit={(newKey) => {
                  renameColumn(index, column.key, newKey);
                }}
              />
              {/* ==========================================================
    END: COLUMN KEY EDITOR
    ========================================================== */}{" "}
            </label>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="ps-ui-action"
        onClick={addColumn}
      >
        <span>{t("table.addColumn")}</span>
      </button>

        {/* =====================================================
            END: COLUMNS
            ===================================================== */}
      </InspectorSection>

      <InspectorSection title={t("inspector.typography")}>
        <ElementTypographyFields
          typography={element.typography}
          effectiveDefaults={{}}
          onUpdateTypography={updateTypography}
          controlPrefix="table"
          fontResources={fontResources}
          visibleProperties={["fontFamily", "fontSize", "lineHeight"]}
          effectiveTypography={resolved?.typography}
          disabledProperties={disabledTypography}
        />
      </InspectorSection>

      <InspectorSection title={t("table.rows")} count={element.rows.length}>
        {/* =====================================================
            BEGIN: ROWS
            ===================================================== */}

      <div className={styles.tableEditorList}>
        {element.rows.length === 0 && (
          <div className={styles.emptyInspectorList}>
            <span>{t("table.noRows")}</span>
          </div>
        )}

        {element.rows.map((row, rowIndex) => (
          <div key={rowIndex} className={styles.tableRowEditor}>
            <div className={styles.tableEditorHeader}>
              <strong>
                <span>{t("table.row", { number: rowIndex + 1 })}</span>
              </strong>

              <button
                type="button"
                className={styles.iconButtonDanger}
                aria-label={t("table.removeRow", { number: rowIndex + 1 })}
                onClick={() => {
                  removeRow(rowIndex);
                }}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <div className={styles.tableCells}>
              {element.columns.map((column, columnIndex) => (
                <div key={column.key} className={styles.tableCellField}>
                  <span className={styles.tableCellLabel}>
                    {getTextContentPlainText(column.label) || column.key}
                  </span>

                  <TableCellEditor
                    controlIdPrefix={`table-${element.id}-row-${rowIndex}-column-${column.key}-${columnIndex}`}
                    controlNamePrefix={`tableCell_${element.id}_${rowIndex}_${column.key}_${columnIndex}`}
                    textHistoryKey={`text:table-${element.id}-row-${rowIndex}-column-${column.key}-value`}
                    numberHistoryKey={`number:table-${element.id}-row-${rowIndex}-column-${column.key}-value`}
                    value={row[column.key]}
                    onChange={(value) => {
                      updateCell(rowIndex, column.key, value);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="ps-ui-action" onClick={addRow}>
        <span>{t("table.addRow")}</span>
      </button>

        {/* =====================================================
            END: ROWS
            ===================================================== */}
      </InspectorSection>

      <CanonicalElementSizeSection
        layout={element.layout}
        effectiveLayout={resolved?.layout}
        disabledFields={disabledLayout.filter((field): field is "width" | "height" => field === "width" || field === "height")}
        onUpdateLayout={(update) => {
          updateTable((table) => ({
            ...table,

            layout: update(table.layout),
          }));
        }}
      />

      <ElementSpacingSection
        layout={element.layout}
        controlPrefix="table"
        onUpdateLayout={(update) => {
          updateTable((table) => ({
            ...table,

            layout: update(table.layout),
          }));
        }}
        effectiveLayout={resolved?.layout}
        disabledFields={disabledLayout.filter((field): field is "margin" | "marginTop" | "marginRight" | "marginBottom" | "marginLeft" => field.startsWith("margin"))}
      />

      <CanonicalDataAppearanceSection
        element={element}
        style={element.style}
        effect={element.effect}
        onUpdateStyle={updateStyle}
        controlPrefix="table"
        showColor
        effectiveColor={effectiveTableColor}
        effectiveColorSource={effectiveTableColorSource}
        onUpdateEffect={updateEffect}
        effectiveStyle={resolved?.style}
        effectiveEffect={resolved?.effect}
        disabledFields={disabledAppearance}
      />

      <CanonicalElementEffectsSection
        effect={element.effect}
        onUpdateEffect={updateEffect}
        controlPrefix="table"
        effectiveEffect={resolved?.effect}
        disabledFields={property("effect.shadow").owned ? ["shadow"] : []}
      />
    </>
  );
}

// ============================================================
// BEGIN: STRUCTURED TABLE INSPECTOR
//
// Minimal authoring surface for Structured Tables. Cell/header
// CONTENT is authored through nested presentation elements; this
// Inspector only mutates the rectangular structure.
// ============================================================

interface StructuredTableInspectorProps {
  element: StructuredTableElement;

  onUpdate: (update: (element: PresentationElement) => PresentationElement) => void;

  tableAuthoringControls: TableAuthoringControls;

  selectedTableStructuralNode?: TableStructuralSelection;

  onSelectTableStructuralNode?: (selection: TableStructuralSelection) => void;

  presentation?: Pick<Presentation, "linkedStyles">;

  onAttachLinkedStyle?: (id: string) => void;

  onDetachLinkedStyle?: () => void;
}

function StructuredTableInspector({
  element,
  onUpdate,
  tableAuthoringControls,
  selectedTableStructuralNode,
  onSelectTableStructuralNode,
  presentation,
  onAttachLinkedStyle,
  onDetachLinkedStyle,
}: StructuredTableInspectorProps) {
  const { t } = useStudioI18n();
  const linkedInspection = inspectTargetLinkedStyle(presentation, element);
  const resolved = linkedInspection.resolved as { layout?: typeof element.layout; style?: CanonicalDataStyle; effect?: ElementEffect } | undefined;
  const property = linkedInspection.getProperty;
  const disabledLayout = (["width", "height", "margin", "marginTop", "marginRight", "marginBottom", "marginLeft"] as const).filter((field) => property(`layout.${field}` as never).owned);
  const disabledAppearance = (["background.color", "background.gradient", "borderRadius", "border", "headerBackground", "bodyRowAlternateBackground", "dividerOpacity", "opacity"] as const).filter((field) => property((field === "opacity" ? "effect.opacity" : `style.${field}`) as never).owned);
  const [pendingRemoval, setPendingRemoval] = useState<TableStructuralSelection>(null);

  function updateTable(
    update: (table: StructuredTableElement) => StructuredTableElement,
  ) {
    onUpdate((current) => {
      if (current.type !== "table" || current.mode !== "structured") {
        return current;
      }

      return update(current);
    });
  }

  const updateStyle = (update: (style: CanonicalDataStyle | undefined) => CanonicalDataStyle) => {
    updateTable((table) => ({
      ...table,
      style: update(table.style),
    }));
  };

  const updateEffect = (update: (effect: ElementEffect | undefined) => ElementEffect) => {
    updateTable((table) => ({ ...table, effect: update(table.effect) }));
  };

  return (
    <>
      <div className={styles.inspectorDivider} />

      {presentation && onAttachLinkedStyle && onDetachLinkedStyle ? <TargetLinkedStyleSection element={element} presentation={presentation} onAttach={onAttachLinkedStyle} onDetach={onDetachLinkedStyle} /> : null}

      <InspectorSection
        title={t("table.columns")}
        count={element.columns.length}
        defaultOpen
      >
        <ul className={styles.collectionSelector} data-presentation-table-column-summary>
          {element.columns.map((column, index) => {
            const selected = selectedTableStructuralNode?.kind === "column" && selectedTableStructuralNode.tableId === element.id && selectedTableStructuralNode.id === column.id;
            const label = getStructuredColumnLabel(element, index, t);
            return <li key={column.id} className={styles.collectionSelectorRow}>
              <span className={styles.collectionOrdinal} aria-hidden="true">{index + 1}.</span>
              <button type="button" className={`${styles.secondaryButton} ${styles.collectionSelectorButton} ${selected ? styles.collectionSelectorButtonSelected : ""}`} aria-pressed={selected} aria-label={label} onClick={() => onSelectTableStructuralNode?.({ kind: "column", tableId: element.id, id: column.id })}>
                <span className={styles.collectionItemName}>{label}</span>
              </button>
            </li>;
          })}
        </ul>
        <div className={styles.tableEditorActions}>
          <button type="button" className="ps-ui-action" data-presentation-table-add-column="true" onClick={() => tableAuthoringControls.onAddColumn(element.id)}>
            <span>{t("table.addColumn")}</span>
          </button>
          <button
            type="button"
            className="ps-ui-action"
            data-presentation-table-remove-column="true"
            disabled={!isSelectedColumn(element, selectedTableStructuralNode)}
            onClick={() => setPendingRemoval(selectedTableStructuralNode ?? null)}
          >
            <span>{t("table.removeColumnAction")}</span>
          </button>
        </div>
      </InspectorSection>

      <InspectorSection
        title={t("table.rows")}
        count={element.rows.length}
        defaultOpen
      >
        <ul className={styles.collectionSelector} data-presentation-table-row-summary>
          {element.rows.map((row, index) => {
            const selected = selectedTableStructuralNode?.kind === "row" && selectedTableStructuralNode.tableId === element.id && selectedTableStructuralNode.id === row.id;
            const label = getStructuredRowLabel(element, index, t);
            return <li key={row.id} className={styles.collectionSelectorRow}>
              <span className={styles.collectionOrdinal} aria-hidden="true">{index + 1}.</span>
              <button type="button" className={`${styles.secondaryButton} ${styles.collectionSelectorButton} ${selected ? styles.collectionSelectorButtonSelected : ""}`} aria-pressed={selected} aria-label={label} onClick={() => onSelectTableStructuralNode?.({ kind: "row", tableId: element.id, id: row.id })}>
                <span className={styles.collectionItemName}>{label}</span>
              </button>
            </li>;
          })}
        </ul>
        <div className={styles.tableEditorActions}>
          <button type="button" className="ps-ui-action" data-presentation-table-add-row="true" onClick={() => tableAuthoringControls.onAddRow(element.id)}>
            <span>{t("table.addRow")}</span>
          </button>
          <button
            type="button"
            className="ps-ui-action"
            data-presentation-table-remove-row="true"
            disabled={!isSelectedRow(element, selectedTableStructuralNode)}
            onClick={() => setPendingRemoval(selectedTableStructuralNode ?? null)}
          >
            <span>{t("table.removeRowAction")}</span>
          </button>
        </div>
      </InspectorSection>

      <InspectorSection title={t("inspector.display")}>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={element.showHeader}
            onChange={(event) => {
              tableAuthoringControls.onShowHeaderChange(
                element.id,
                event.target.checked,
              );
            }}
          />
          <span>{t("table.showHeader")}</span>
        </label>
      </InspectorSection>

      <CanonicalElementSizeSection
        layout={element.layout}
        effectiveLayout={resolved?.layout}
        disabledFields={disabledLayout.filter((field): field is "width" | "height" => field === "width" || field === "height")}
        onUpdateLayout={(update) => {
          updateTable((table) => ({
            ...table,

            layout: update(table.layout),
          }));
        }}
      />

      <ElementSpacingSection
        layout={element.layout}
        controlPrefix="table"
        onUpdateLayout={(update) => {
          updateTable((table) => ({
            ...table,

            layout: update(table.layout),
          }));
        }}
        effectiveLayout={resolved?.layout}
        disabledFields={disabledLayout.filter((field): field is "margin" | "marginTop" | "marginRight" | "marginBottom" | "marginLeft" => field.startsWith("margin"))}
      />

      <CanonicalDataAppearanceSection
        element={element}
        style={element.style}
        effect={element.effect}
        onUpdateStyle={updateStyle}
        controlPrefix="table"
        onUpdateEffect={updateEffect}
        effectiveStyle={resolved?.style}
        effectiveEffect={resolved?.effect}
        disabledFields={disabledAppearance}
      />

      <CanonicalElementEffectsSection
        effect={element.effect}
        onUpdateEffect={updateEffect}
        controlPrefix="table"
        effectiveEffect={resolved?.effect}
        disabledFields={property("effect.shadow").owned ? ["shadow"] : []}
      />
      {pendingRemoval ? (() => {
        const index = pendingRemoval.kind === "column"
          ? element.columns.findIndex((column) => column.id === pendingRemoval.id)
          : element.rows.findIndex((row) => row.id === pendingRemoval.id);
        const label = pendingRemoval.kind === "column"
          ? getStructuredColumnLabel(element, index, t)
          : getStructuredRowLabel(element, index, t);
        return <DangerConfirmDialog
          title={t("table.removeConfirmTitle", { label })}
          message={t("table.removeConfirmBody")}
          confirmLabel={pendingRemoval.kind === "column" ? t("table.removeColumn", { number: index + 1 }) : t("table.removeRow", { number: index + 1 })}
          cancelLabel={t("elementCrud.cancel")}
          onCancel={() => setPendingRemoval(null)}
          onConfirm={() => {
            const currentIndex = pendingRemoval.kind === "column"
              ? element.columns.findIndex((column) => column.id === pendingRemoval.id)
              : element.rows.findIndex((row) => row.id === pendingRemoval.id);
            if (currentIndex >= 0) {
              if (pendingRemoval.kind === "column") tableAuthoringControls.onRemoveColumn(element.id, currentIndex);
              else tableAuthoringControls.onRemoveRow(element.id, currentIndex);
              const nextIndex = Math.min(currentIndex, (pendingRemoval.kind === "column" ? element.columns.length : element.rows.length) - 2);
              const nextId = pendingRemoval.kind === "column" ? element.columns[nextIndex]?.id : element.rows[nextIndex]?.id;
              onSelectTableStructuralNode?.(nextId ? { ...pendingRemoval, id: nextId } : null);
            }
            setPendingRemoval(null);
          }}
        />;
      })() : null}
    </>
  );
}

function selectedColumnIndex(element: StructuredTableElement, selection?: TableStructuralSelection): number {
  return selection?.kind === "column" && selection.tableId === element.id ? element.columns.findIndex((column) => column.id === selection.id) : -1;
}

function selectedRowIndex(element: StructuredTableElement, selection?: TableStructuralSelection): number {
  return selection?.kind === "row" && selection.tableId === element.id ? element.rows.findIndex((row) => row.id === selection.id) : -1;
}

function isSelectedColumn(element: StructuredTableElement, selection?: TableStructuralSelection): boolean {
  return selectedColumnIndex(element, selection) >= 0;
}

function isSelectedRow(element: StructuredTableElement, selection?: TableStructuralSelection): boolean {
  return selectedRowIndex(element, selection) >= 0;
}

// ============================================================
// END: STRUCTURED TABLE INSPECTOR
// ============================================================

// ============================================================
// END: TABLE INSPECTOR
// ============================================================
