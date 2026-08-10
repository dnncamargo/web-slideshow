import { useState } from "react";

import type { PowerShowElement } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import { InspectorSection } from "./inspector-section";

import type { UpdateElementStyle } from "./inspector-types";

import { ElementAppearanceSection } from "./sections/element-appearance-section";

import { ElementEffectsSection } from "./sections/element-effects-section";

// ============================================================
// BEGIN: TIPOS DO TABLE INSPECTOR
// ============================================================

type TableElement = Extract<
  PowerShowElement,
  {
    type: "table";
  }
>;

type TableColumn = TableElement["columns"][number];

type TableRow = TableElement["rows"][number];

type TableCellValue = TableRow[string];

interface TableInspectorProps {
  element: TableElement;

  onUpdate: (update: (element: PowerShowElement) => PowerShowElement) => void;
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

      const converted = Number(value);

      return Number.isFinite(converted) ? converted : 0;
    }

    case "boolean":
      return typeof value === "boolean" ? value : false;

    case "null":
      return null;

    case "string":
    default:
      return value === undefined || value === null ? "" : String(value);
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

  function commit() {
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

  value: TableCellValue | undefined;

  onChange: (value: TableCellValue) => void;
}

function TableCellEditor({
  controlIdPrefix,
  controlNamePrefix,
  value,
  onChange,
}: TableCellEditorProps) {
  const type = getCellType(value);
  const { t } = useStudioI18n();

  return (
    <div className={styles.tableCellEditor}>
      <select
        id={`${controlIdPrefix}-type`}
        name={`${controlNamePrefix}Type`}
        className={styles.tableCellType}
        value={type}
        onChange={(event) => {
          onChange(
            convertCellType(
              value,

              event.target.value as "string" | "number" | "boolean" | "null",
            ),
          );
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
          value={typeof value === "string" ? value : ""}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      )}

      {type === "number" && (
        <input
          id={`${controlIdPrefix}-value`}
          name={`${controlNamePrefix}Value`}
          type="number"
          value={typeof value === "number" ? value : 0}
          onChange={(event) => {
            const number = Number(event.target.value);

            onChange(Number.isFinite(number) ? number : 0);
          }}
        />
      )}

      {type === "boolean" && (
        <select
          id={`${controlIdPrefix}-value`}
          name={`${controlNamePrefix}Value`}
          value={value === true ? "true" : "false"}
          onChange={(event) => {
            onChange(event.target.value === "true");
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
// ============================================================

export function TableInspector({ element, onUpdate }: TableInspectorProps) {
  const { t } = useStudioI18n();

  // ==========================================================
  // BEGIN: UPDATE GENÉRICO DE TABLE
  // ==========================================================

  function updateTable(update: (table: TableElement) => TableElement) {
    onUpdate((current) => {
      if (current.type !== "table") {
        return current;
      }

      return update(current);
    });
  }

  const updateStyle: UpdateElementStyle = (update) => {
    updateTable((table) => ({
      ...table,

      style: update(table.style),
    }));
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

  function renameColumn(index: number, newKey: string) {
    updateTable((table) => {
      const column = table.columns[index];

      if (!column) {
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
  }

  // ==========================================================
  // END: RENOMEAR KEY DE COLUNA
  // ==========================================================

  // ==========================================================
  // BEGIN: ADICIONAR COLUNA
  // ==========================================================

  function addColumn() {
    updateTable((table) => {
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
  }

  // ==========================================================
  // END: ADICIONAR COLUNA
  // ==========================================================

  // ==========================================================
  // BEGIN: REMOVER COLUNA
  // ==========================================================

  function removeColumn(index: number) {
    updateTable((table) => {
      const column = table.columns[index];

      if (!column) {
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
  }

  // ==========================================================
  // END: REMOVER COLUNA
  // ==========================================================

  // ==========================================================
  // BEGIN: ADICIONAR LINHA
  // ==========================================================

  function addRow() {
    updateTable((table) => {
      const row: TableRow = {};

      for (const column of table.columns) {
        row[column.key] = "";
      }

      return {
        ...table,

        rows: [...table.rows, row],
      };
    });
  }

  // ==========================================================
  // END: ADICIONAR LINHA
  // ==========================================================

  // ==========================================================
  // BEGIN: REMOVER LINHA
  // ==========================================================

  function removeRow(index: number) {
    updateTable((table) => ({
      ...table,

      rows: table.rows.filter((_row, rowIndex) => rowIndex !== index),
    }));
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

  // ==========================================================
  // END: ATUALIZAR CÉLULA
  // ==========================================================

  return (
    <>
      <div className={styles.inspectorDivider} />

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
                  removeColumn(index);
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
                value={column.label}
                onChange={(event) => {
                  const label = event.target.value;

                  updateTable((table) => ({
                    ...table,

                    columns: table.columns.map((currentColumn, columnIndex) =>
                      columnIndex === index
                        ? {
                            ...currentColumn,

                            label,
                          }
                        : currentColumn,
                    ),
                  }));
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
                  renameColumn(index, newKey);
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
        className={styles.secondaryButton}
        onClick={addColumn}
      >
        <span>{t("table.addColumn")}</span>
      </button>

        {/* =====================================================
            END: COLUMNS
            ===================================================== */}
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
                    {column.label || column.key}
                  </span>

                  <TableCellEditor
                    controlIdPrefix={`table-${element.id}-row-${rowIndex}-column-${column.key}-${columnIndex}`}
                    controlNamePrefix={`tableCell_${element.id}_${rowIndex}_${column.key}_${columnIndex}`}
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

      <button type="button" className={styles.secondaryButton} onClick={addRow}>
        <span>{t("table.addRow")}</span>
      </button>

        {/* =====================================================
            END: ROWS
            ===================================================== */}
      </InspectorSection>

      <ElementAppearanceSection
        style={element.style}
        onUpdateStyle={updateStyle}
        controlPrefix="table"
        showBackground
        showBackgroundGradient
        showRoundedCorners
        showOpacity
        showBorder
      />

      <ElementEffectsSection
        style={element.style}
        onUpdateStyle={updateStyle}
        controlPrefix="table"
      />
    </>
  );
}

// ============================================================
// END: TABLE INSPECTOR
// ============================================================
