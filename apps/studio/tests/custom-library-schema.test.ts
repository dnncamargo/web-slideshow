import { describe, expect, it } from "vitest";

import type { PresentationElement } from "@web-slideshow/document-schema";

import {
  createCustomLibraryItemDraft,
} from "../src/features/custom-library/custom-library-item";
import {
  CustomLibraryItemDraftSchema,
  parseCustomLibraryItemDraft,
} from "../src/features/custom-library/custom-library-schema";

const text = (id = "text-1"): PresentationElement => ({
  type: "text",
  id,
  hidden: false,
  content: "Presentation title",
  variant: "title",
});

const textRecipe = (properties: unknown[] = []) => ({
  type: "text",
  properties,
});

const containerRecipe = (children?: unknown[], properties: unknown[] = []) => ({
  type: "container",
  properties,
  ...(children === undefined ? {} : { children }),
});

const item = (root: unknown = textRecipe()) => ({ name: "Widget", root });

const expectInvalid = (value: unknown) => {
  expect(() => parseCustomLibraryItemDraft(value)).toThrow();
};

describe("Custom Library persisted contract", () => {
  const font = {
    family: "Fira Code",
    faces: [{ source: { type: "url" as const, url: "https://example.com/fira.woff2", format: "woff2" as const }, weight: 400, style: "normal" as const }],
  };

  it("accepts legacy and valid dependency records, but rejects empty or duplicate dependencies", () => {
    expect(parseCustomLibraryItemDraft(item())).toEqual(item());
    expect(parseCustomLibraryItemDraft({ ...item(), dependencies: { fonts: [font] } })).toEqual({ ...item(), dependencies: { fonts: [font] } });
    expect(() => parseCustomLibraryItemDraft({ ...item(), dependencies: { fonts: [font, { ...font, family: " fira code " }] } })).toThrow();
    expectInvalid({ ...item(), dependencies: {} });
    expectInvalid({ ...item(), dependencies: { fonts: [] } });
    expectInvalid({ ...item(), dependencies: { fonts: [font], extra: true } });
    expectInvalid({ ...item(), dependencies: { fonts: [{ family: "Fira Code", faces: [] }] } });
    expect(parseCustomLibraryItemDraft({ ...item(), dependencies: { textStyles: [{ id: "example", name: "Example", role: "body" }] } })).toEqual({ ...item(), dependencies: { textStyles: [{ id: "example", name: "Example", role: "body" }] } });
    expect(parseCustomLibraryItemDraft({ ...item(), dependencies: { linkedStyles: [{ id: "card", name: "Card", layout: { padding: 8 } }] } })).toEqual({ ...item(), dependencies: { linkedStyles: [{ id: "card", name: "Card", layout: { padding: 8 } }] } });
    expectInvalid({ ...item(), dependencies: { textStyles: [{ id: "example", name: "Example", role: "body" }, { id: "example", name: "Other", role: "body" }] } });
    expectInvalid({ ...item(), dependencies: { linkedStyles: [{ id: "card", name: "Card", layout: { padding: 8 } }, { id: "card", name: "Other", layout: { padding: 9 } }] } });
  });

  it("accepts a builder-produced text item", () => {
    const draft = createCustomLibraryItemDraft({
      name: "Widget",
      root: text(),
      selections: new Map([["text-1", new Set(["variant"])] ]),
    });

    expect(parseCustomLibraryItemDraft(draft)).toEqual(draft);
  });

  it("accepts builder-produced and nested container compositions", () => {
    const child = text("child");
    const nested: PresentationElement = {
      type: "container",
      id: "nested",
      hidden: false,
      children: [child],
    };
    const root: PresentationElement = {
      type: "container",
      id: "root",
      hidden: false,
      children: [nested, text("sibling")],
    };

    const draft = createCustomLibraryItemDraft({
      name: "Nested",
      root,
      selections: new Map([
        ["root", new Set<string>()],
        ["nested", new Set<string>()],
        ["child", new Set(["variant"])],
        ["sibling", new Set(["variant"])],
      ]),
    });

    expect(parseCustomLibraryItemDraft(draft)).toEqual(draft);
  });

  it("accepts empty properties and JSON-safe values", () => {
    const values = [null, true, "value", 12.5, ["nested", 1], { nested: { value: false } }];

    expect(parseCustomLibraryItemDraft(item(textRecipe()))).toEqual(item(textRecipe()));
    values.forEach((value) => {
      expect(parseCustomLibraryItemDraft(item(textRecipe([{ path: "value", value }])))).toEqual(
        item(textRecipe([{ path: "value", value }])),
      );
    });
  });

  it.each(["", "   ", " Textbox ", "\nTextbox"]) ("rejects invalid names: %j", (name) => {
    expectInvalid({ ...item(), name });
  });

  it("accepts an absent description", () => {
    expect(parseCustomLibraryItemDraft(item())).not.toHaveProperty("description");
  });

  it.each(["", "   ", " Description "]) ("rejects invalid descriptions: %j", (description) => {
    expectInvalid({ ...item(), description });
  });

  it("rejects ids, timestamps, versions, and unknown fields at every persisted level", () => {
    expectInvalid({ ...item(), id: "item-id" });
    expectInvalid({ ...item(), createdAt: "now" });
    expectInvalid({ ...item({ ...textRecipe(), id: "source-id" }) });
    expectInvalid({ ...item({ ...textRecipe(), stale: true }) });
    expectInvalid({
      ...item(textRecipe([{ path: "value", value: "ok", extra: true }])),
    });
  });

  it("rejects reserved paths but permits layout.children properties", () => {
    expectInvalid(item(textRecipe([{ path: "id", value: "source-id" }])));
    expectInvalid(item(textRecipe([{ path: "type", value: "text" }])));
    expectInvalid(item(containerRecipe(undefined, [{ path: "children", value: [] }])));
    expect(parseCustomLibraryItemDraft(item(containerRecipe(undefined, [
      { path: "layout.children.gap", value: "12px" },
    ])))).toEqual(item(containerRecipe(undefined, [
      { path: "layout.children.gap", value: "12px" },
    ])));
  });

  it("rejects duplicate paths", () => {
    expectInvalid(item(textRecipe([
      { path: "style.color", value: "#fff" },
      { path: "style.color", value: "#000" },
    ])));
  });

  it("enforces recipe child structure and preserves order", () => {
    expectInvalid(item({ ...textRecipe(), children: [textRecipe()] }));
    expectInvalid(item(containerRecipe([])));

    const value = item(containerRecipe([
      textRecipe([{ path: "label", value: "first" }]),
      { type: "image", properties: [] },
      textRecipe([{ path: "label", value: "last" }]),
    ]));
    const parsed = parseCustomLibraryItemDraft(value);

    expect(parsed.root.children?.map((child) => child.type)).toEqual(["text", "image", "text"]);
  });

  it.each([
    undefined,
    () => "function",
    BigInt(1),
    new Date("2026-01-01"),
    new Map([[["key"], "value"]]),
    new Set(["value"]),
    NaN,
    Infinity,
  ])("rejects non-JSON-safe property value %#", (value) => {
    expectInvalid(item(textRecipe([{ path: "value", value }])));
  });

  it("does not mutate input while parsing", () => {
    const value = item(containerRecipe([
      textRecipe([{ path: "content", value: { nested: ["value"] } }]),
    ]));
    const before = structuredClone(value);

    expect(parseCustomLibraryItemDraft(value)).toEqual(before);
    expect(value).toEqual(before);
  });

  it("keeps builder output reference-independent", () => {
    const source: PresentationElement = {
      type: "table",
      id: "table-id",
      hidden: false,
      mode: "simple",
      columns: [{ key: "name", label: "Name" }],
      rows: [{ name: "Example" }],
    };
    const draft = createCustomLibraryItemDraft({
      name: "Table",
      root: source,
      selections: new Map([[source.id, new Set(["rows"])]]),
    });
    const rows = draft.root.properties[0]?.value as Array<Record<string, string>>;

    rows[0]!.name = "Changed";

    expect(source.rows[0]).toEqual({ name: "Example" });
    expect(CustomLibraryItemDraftSchema.parse(draft)).toEqual(draft);
  });
});
