import type { PresentationFileResource } from "@web-slideshow/document-schema";

export type ImportedTableData = {
  columns: string[];
  rows: string[][];
};

export type StructuredDataImportFailureReason =
  | "invalid-csv"
  | "invalid-json"
  | "invalid-xml"
  | "unsupported-format"
  | "unsupported-structure";

export type StructuredDataImportResult =
  | { ok: true; data: ImportedTableData }
  | { ok: false; reason: StructuredDataImportFailureReason };

const STRUCTURED_DATA_CONTENT_TYPES = [
  "text/csv",
  "application/json",
  "application/xml",
] as const;

type StructuredDataContentType = (typeof STRUCTURED_DATA_CONTENT_TYPES)[number];

export function isStructuredDataFile(
  file: PresentationFileResource,
): file is Extract<PresentationFileResource, { representation: "text" }> & {
  kind: "structured-data";
  contentType: StructuredDataContentType;
} {
  return file.kind === "structured-data" &&
    file.representation === "text" &&
    (STRUCTURED_DATA_CONTENT_TYPES as readonly string[]).includes(file.contentType);
}

export function parseStructuredDataFile(
  file: PresentationFileResource,
): StructuredDataImportResult {
  if (!isStructuredDataFile(file)) {
    return { ok: false, reason: "unsupported-format" };
  }

  return parseStructuredData(file.contentType, file.source.content);
}

export function parseStructuredData(
  contentType: string,
  content: string,
): StructuredDataImportResult {
  switch (contentType) {
    case "text/csv":
      return parseCsv(content);
    case "application/json":
      return parseJson(content);
    case "application/xml":
      return parseXml(content);
    default:
      return { ok: false, reason: "unsupported-format" };
  }
}

function parseCsv(content: string): StructuredDataImportResult {
  const source = content.startsWith("\uFEFF") ? content.slice(1) : content;
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let fieldStarted = false;
  let inQuotes = false;
  let quoteClosed = false;

  const finishRecord = (): void => {
    record.push(field);
    records.push(record);
    record = [];
    field = "";
    fieldStarted = false;
    quoteClosed = false;
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          quoteClosed = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (quoteClosed) {
      if (character === ",") {
        record.push(field);
        field = "";
        fieldStarted = false;
        quoteClosed = false;
        continue;
      }

      if (character === "\n") {
        finishRecord();
        continue;
      }

      if (character === "\r") {
        if (source[index + 1] === "\n") index += 1;
        finishRecord();
        continue;
      }

      return { ok: false, reason: "invalid-csv" };
    }

    if (character === '"') {
      if (fieldStarted) return { ok: false, reason: "invalid-csv" };
      inQuotes = true;
      fieldStarted = true;
      continue;
    }

    if (character === ",") {
      record.push(field);
      field = "";
      fieldStarted = false;
      continue;
    }

    if (character === "\n") {
      finishRecord();
      continue;
    }

    if (character === "\r") {
      if (source[index + 1] === "\n") index += 1;
      finishRecord();
      continue;
    }

    field += character;
    fieldStarted = true;
  }

  if (inQuotes) return { ok: false, reason: "invalid-csv" };

  if (fieldStarted || field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const columns = records[0];
  if (columns === undefined || columns.length < 1) {
    return { ok: false, reason: "unsupported-structure" };
  }

  const rows: string[][] = [];
  for (const sourceRow of records.slice(1)) {
    if (sourceRow.length > columns.length) {
      return { ok: false, reason: "unsupported-structure" };
    }

    rows.push([...sourceRow, ...Array.from({ length: columns.length - sourceRow.length }, () => "")]);
  }

  return { ok: true, data: { columns: [...columns], rows } };
}

function parseJson(content: string): StructuredDataImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    return { ok: false, reason: "invalid-json" };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, reason: "unsupported-structure" };
  }

  if (parsed.length === 0) {
    return { ok: false, reason: "unsupported-structure" };
  }

  const rows = parsed.map((value) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  });

  if (rows.some((row) => row === null)) {
    return { ok: false, reason: "unsupported-structure" };
  }

  const columns: string[] = [];
  const seenColumns = new Set<string>();
  for (const row of rows) {
    if (row === null) continue;
    for (const key of Object.keys(row)) {
      if (!seenColumns.has(key)) {
        seenColumns.add(key);
        columns.push(key);
      }
    }
  }

  if (columns.length === 0) {
    return { ok: false, reason: "unsupported-structure" };
  }

  const normalizedRows: string[][] = [];
  for (const row of rows) {
    if (row === null) continue;
    const normalizedRow: string[] = [];
    for (const column of columns) {
      if (!Object.prototype.hasOwnProperty.call(row, column) || row[column] === null) {
        normalizedRow.push("");
        continue;
      }

      const value = row[column];
      if (typeof value === "string") {
        normalizedRow.push(value);
      } else if (typeof value === "number" || typeof value === "boolean") {
        normalizedRow.push(String(value));
      } else {
        return { ok: false, reason: "unsupported-structure" };
      }
    }
    normalizedRows.push(normalizedRow);
  }

  return { ok: true, data: { columns, rows: normalizedRows } };
}

function parseXml(content: string): StructuredDataImportResult {
  if (/<!DOCTYPE\b/i.test(content)) {
    return { ok: false, reason: "unsupported-structure" };
  }

  const domParser = (globalThis as { DOMParser?: new () => DOMParser }).DOMParser;
  if (domParser === undefined) {
    return { ok: false, reason: "invalid-xml" };
  }

  return parseXmlWithDomParser(content, domParser);
}

function parseXmlWithDomParser(
  content: string,
  DomParser: new () => DOMParser,
): StructuredDataImportResult {
  let document: XMLDocument;
  try {
    document = new DomParser().parseFromString(content, "application/xml");
  } catch {
    return { ok: false, reason: "invalid-xml" };
  }

  const root = document.documentElement;
  if (root === null || root.localName === "parsererror" || document.getElementsByTagName("parsererror").length > 0) {
    return { ok: false, reason: "invalid-xml" };
  }

  const rowElements = Array.from(root.children);
  if (rowElements.length === 0 || Array.from(root.childNodes).some((node) => node.nodeType === 3 && node.textContent?.trim() !== "")) {
    return { ok: false, reason: "unsupported-structure" };
  }

  const rowName = rowElements[0]?.tagName;
  if (rowName === undefined || rowElements.some((row) => row.tagName !== rowName)) {
    return { ok: false, reason: "unsupported-structure" };
  }

  const columns: string[] = [];
  const seenColumns = new Set<string>();
  const rowValues: Map<string, string>[] = [];

  for (const row of rowElements) {
    if (Array.from(row.childNodes).some((node) => node.nodeType === 3 && node.textContent?.trim() !== "")) {
      return { ok: false, reason: "unsupported-structure" };
    }
    const values = new Map<string, string>();
    for (const field of Array.from(row.children)) {
      if (field.children.length > 0 || values.has(field.tagName)) {
        return { ok: false, reason: "unsupported-structure" };
      }
      values.set(field.tagName, field.textContent.trim());
      if (!seenColumns.has(field.tagName)) {
        seenColumns.add(field.tagName);
        columns.push(field.tagName);
      }
    }
    rowValues.push(values);
  }

  if (columns.length === 0) {
    return { ok: false, reason: "unsupported-structure" };
  }

  return {
    ok: true,
    data: {
      columns,
      rows: rowValues.map((values) => columns.map((column) => values.get(column) ?? "")),
    },
  };
}
