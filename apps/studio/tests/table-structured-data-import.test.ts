// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  isStructuredDataFile,
  parseStructuredData,
  parseStructuredDataFile,
} from "../src/features/editor/table-structured-data-import";

describe("structured data table import parsers", () => {
  it("parses CSV headers, rows, BOM, CRLF, quoted commas, escaped quotes, and multiline fields", () => {
    expect(parseStructuredData("text/csv", "\uFEFFname,note\r\nAlice,\"hello, world\"\r\nBob,\"say \"\"hi\"\"\"\r\nCara,\"line 1\r\nline 2\"\r\n")).toEqual({
      ok: true,
      data: {
        columns: ["name", "note"],
        rows: [
          ["Alice", "hello, world"],
          ["Bob", 'say "hi"'],
          ["Cara", "line 1\r\nline 2"],
        ],
      },
    });
  });

  it("pads short CSV records and rejects over-wide or malformed records", () => {
    expect(parseStructuredData("text/csv", "a,b\n1\n")).toEqual({
      ok: true,
      data: { columns: ["a", "b"], rows: [["1", ""]] },
    });
    expect(parseStructuredData("text/csv", "a,b\n1,2,3")).toMatchObject({ ok: false, reason: "unsupported-structure" });
    expect(parseStructuredData("text/csv", "a,b\n1,\"unterminated")).toEqual({ ok: false, reason: "invalid-csv" });
    expect(parseStructuredData("text/csv", "a,b\n1,\"closed\"tail")).toEqual({ ok: false, reason: "invalid-csv" });
    expect(parseStructuredData("text/csv", "")).toMatchObject({ ok: false });
  });

  it("preserves JSON first-seen columns and normalizes supported scalar values", () => {
    expect(parseStructuredData("application/json", JSON.stringify([
      { name: "Alice", age: 30 },
      { name: "Bob", active: true, age: null },
    ]))).toEqual({
      ok: true,
      data: {
        columns: ["name", "age", "active"],
        rows: [["Alice", "30", ""], ["Bob", "", "true"]],
      },
    });
  });

  it("rejects malformed and unsupported JSON structures", () => {
    expect(parseStructuredData("application/json", "{")).toEqual({ ok: false, reason: "invalid-json" });
    expect(parseStructuredData("application/json", "{}"),).toMatchObject({ ok: false, reason: "unsupported-structure" });
    expect(parseStructuredData("application/json", "[]")).toMatchObject({ ok: false, reason: "unsupported-structure" });
    expect(parseStructuredData("application/json", "[1]")).toMatchObject({ ok: false, reason: "unsupported-structure" });
    expect(parseStructuredData("application/json", JSON.stringify([{ value: { nested: true } }]))).toMatchObject({ ok: false, reason: "unsupported-structure" });
    expect(parseStructuredData("application/json", JSON.stringify([{}]))).toMatchObject({ ok: false, reason: "unsupported-structure" });
  });

  it("parses repeated XML records with first-seen fields and trimmed field text", () => {
    expect(parseStructuredData("application/xml", "<?xml version=\"1.0\"?><people><person><name> Alice </name><age>30</age></person><person><name>Bob</name><active>true</active></person></people>")).toEqual({
      ok: true,
      data: {
        columns: ["name", "age", "active"],
        rows: [["Alice", "30", ""], ["Bob", "", "true"]],
      },
    });
  });

  it("rejects malformed, dangerous, and ambiguous XML structures", () => {
    expect(parseStructuredData("application/xml", "<people><person></people>")).toMatchObject({ ok: false, reason: "invalid-xml" });
    expect(parseStructuredData("application/xml", "<!DOCTYPE people><people><person><name>Alice</name></person></people>")).toMatchObject({ ok: false, reason: "unsupported-structure" });
    expect(parseStructuredData("application/xml", "<people><person><name><given>Alice</given></name></person></people>")).toMatchObject({ ok: false, reason: "unsupported-structure" });
    expect(parseStructuredData("application/xml", "<people><person><name>Alice</name><name>Again</name></person></people>")).toMatchObject({ ok: false, reason: "unsupported-structure" });
    expect(parseStructuredData("application/xml", "<people><person><name>Alice</name></person><other><name>Bob</name></other></people>")).toMatchObject({ ok: false, reason: "unsupported-structure" });
    expect(parseStructuredData("application/xml", "<people><person><name>&foo;</name></person></people>")).toEqual({ ok: false, reason: "invalid-xml" });
    expect(parseStructuredData("application/xml", "<people><person /></people>")).toMatchObject({ ok: false, reason: "unsupported-structure" });
    expect(parseStructuredData("application/xml", "<people />")).toMatchObject({ ok: false, reason: "unsupported-structure" });
  });

  it("accepts only text Structured Data Presentation Files", () => {
    const file = {
      id: "file-csv",
      name: "data.csv",
      kind: "structured-data",
      representation: "text",
      contentType: "text/csv",
      source: { type: "text", content: "a\n1" },
    } as const;
    expect(isStructuredDataFile(file)).toBe(true);
    expect(parseStructuredDataFile(file)).toMatchObject({ ok: true });
    expect(parseStructuredDataFile({ ...file, kind: "text", contentType: "text/plain" } as never)).toEqual({ ok: false, reason: "unsupported-format" });
  });
});
