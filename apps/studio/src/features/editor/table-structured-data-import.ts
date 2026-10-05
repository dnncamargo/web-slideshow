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

type XmlNode = XmlElement | { kind: "text"; value: string };

type XmlElement = {
  kind: "element";
  name: string;
  children: XmlNode[];
};

function parseXml(content: string): StructuredDataImportResult {
  if (/<!DOCTYPE\b/i.test(content)) {
    return { ok: false, reason: "unsupported-structure" };
  }

  const domParser = (globalThis as { DOMParser?: new () => DOMParser }).DOMParser;
  if (domParser !== undefined) {
    return parseXmlWithDomParser(content, domParser);
  }

  return parseXmlWithFallback(content);
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

function parseXmlWithFallback(content: string): StructuredDataImportResult {
  const source = content.replace(/^\s*<\?xml\b[\s\S]*?\?>\s*/i, "");
  const stack: XmlElement[] = [];
  let root: XmlElement | undefined;
  let position = 0;

  const appendText = (value: string): boolean => {
    if (value.length === 0) return true;
    if (stack.length === 0) return value.trim() === "";
    appendXmlText(stack, value);
    return true;
  };

  while (position < source.length) {
    const tagStart = source.indexOf("<", position);
    if (tagStart < 0) {
      if (!appendText(source.slice(position))) return { ok: false, reason: "invalid-xml" };
      break;
    }

    if (!appendText(source.slice(position, tagStart))) return { ok: false, reason: "invalid-xml" };
    const tagEnd = findXmlTagEnd(source, tagStart + 1);
    if (tagEnd < 0) return { ok: false, reason: "invalid-xml" };
    const token = source.slice(tagStart + 1, tagEnd).trim();
    position = tagEnd + 1;

    if (token.startsWith("!--")) {
      if (!token.endsWith("--")) return { ok: false, reason: "invalid-xml" };
      continue;
    }
    if (token.startsWith("![CDATA[")) {
      if (!token.endsWith("]]")) return { ok: false, reason: "invalid-xml" };
      if (stack.length === 0) return { ok: false, reason: "invalid-xml" };
      appendXmlText(stack, token.slice(8, -2));
      continue;
    }
    if (token.startsWith("?") || token.startsWith("!")) {
      return { ok: false, reason: "unsupported-structure" };
    }

    if (token.startsWith("/")) {
      const closingName = token.slice(1).trim();
      const current = stack.pop();
      if (current === undefined || closingName !== current.name) {
        return { ok: false, reason: "invalid-xml" };
      }
      continue;
    }

    const selfClosing = token.endsWith("/");
    const openingToken = selfClosing ? token.slice(0, -1).trim() : token;
    const nameMatch = /^([A-Za-z_][A-Za-z0-9_.:-]*)([\s\S]*)$/.exec(openingToken);
    if (nameMatch === null || !validXmlAttributes(nameMatch[2] ?? "")) {
      return { ok: false, reason: "invalid-xml" };
    }

    const element: XmlElement = { kind: "element", name: nameMatch[1], children: [] };
    const parent = stack[stack.length - 1];
    if (parent !== undefined) {
      parent.children.push(element);
    } else if (root === undefined) {
      root = element;
    } else {
      return { ok: false, reason: "invalid-xml" };
    }

    if (!selfClosing) stack.push(element);
  }

  if (stack.length > 0 || root === undefined) {
    return { ok: false, reason: "invalid-xml" };
  }

  const rowElements = root.children.filter((child): child is XmlElement => child.kind === "element");
  if (rowElements.length === 0 || root.children.some((child) => child.kind === "text" && child.value.trim() !== "")) {
    return { ok: false, reason: "unsupported-structure" };
  }

  const rowName = rowElements[0]?.name;
  if (rowName === undefined || rowElements.some((row) => row.name !== rowName)) {
    return { ok: false, reason: "unsupported-structure" };
  }

  const columns: string[] = [];
  const seenColumns = new Set<string>();
  const rowValues: Map<string, string>[] = [];

  for (const row of rowElements) {
    const fields = row.children.filter((child): child is XmlElement => child.kind === "element");
    if (row.children.some((child) => child.kind === "text" && child.value.trim() !== "")) {
      return { ok: false, reason: "unsupported-structure" };
    }

    const values = new Map<string, string>();
    for (const field of fields) {
      if (field.children.some((child) => child.kind === "element") || values.has(field.name)) {
        return { ok: false, reason: "unsupported-structure" };
      }
      values.set(field.name, xmlTextContent(field).trim());
      if (!seenColumns.has(field.name)) {
        seenColumns.add(field.name);
        columns.push(field.name);
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

function appendXmlText(stack: XmlElement[], value: string): void {
  if (value.length === 0 || stack.length === 0) return;
  stack[stack.length - 1]?.children.push({ kind: "text", value: decodeXmlEntities(value) });
}

function xmlTextContent(element: XmlElement): string {
  return element.children.map((child) => child.kind === "text" ? child.value : xmlTextContent(child)).join("");
}

function findXmlTagEnd(source: string, start: number): number {
  let quote: '"' | "'" | null = null;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote !== null) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return index;
    }
  }
  return -1;
}

function validXmlAttributes(source: string): boolean {
  let rest = source.trim();
  while (rest.length > 0) {
    const match = /^([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*("[^"]*"|'[^']*')(.*)$/.exec(rest);
    if (match === null) return false;
    rest = (match[3] ?? "").trim();
  }
  return true;
}

function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code: string) => {
    switch (code.toLowerCase()) {
      case "amp": return "&";
      case "lt": return "<";
      case "gt": return ">";
      case "quot": return '"';
      case "apos": return "'";
      default:
        if (code.toLowerCase().startsWith("#x")) {
          return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
        }
        return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    }
  });
}
