import {
  describe,
  expect,
  it,
} from "vitest";

import {
  renderTable,
} from "../src/render-table";

import {
  createTableElement,
} from "./fixtures/render-fixtures";

function bodyMarkup(html: string): string {
  const bodyStart = html.indexOf("<tbody>");
  const bodyEnd = html.indexOf("</tbody>");

  return html.slice(bodyStart, bodyEnd);
}

describe("renderTable", () => {
  it("uses declared column order rather than row key order", () => {
    const html = renderTable(
      createTableElement({
        columns: [
          { key: "first", label: "First" },
          { key: "second", label: "Second" },
        ],
        rows: [
          {
            second: "row-second",
            first: "row-first",
          },
        ],
      }),
    );

    expect(html.indexOf(">First</th>")).toBeLessThan(
      html.indexOf(">Second</th>"),
    );
    expect(html.indexOf(">row-first</td>")).toBeLessThan(
      html.indexOf(">row-second</td>"),
    );
  });

  it("renders multiple rows in source order", () => {
    const html = renderTable(
      createTableElement({
        columns: [
          { key: "name", label: "Name" },
        ],
        rows: [
          { name: "First row" },
          { name: "Second row" },
          { name: "Third row" },
        ],
      }),
    );

    const body = bodyMarkup(html);

    expect(body.split("<tr>").length - 1).toBe(3);
    expect(body.indexOf("First row")).toBeLessThan(
      body.indexOf("Second row"),
    );
    expect(body.indexOf("Second row")).toBeLessThan(
      body.indexOf("Third row"),
    );
  });

  it("renders an empty tbody when rows are empty", () => {
    const html = renderTable(
      createTableElement({
        columns: [
          { key: "value", label: "Value" },
        ],
        rows: [],
      }),
    );

    expect(html).toContain("<tbody>");
    expect(bodyMarkup(html)).not.toContain("<tr>");
  });

  it("renders null cells as empty cells", () => {
    const html = renderTable(
      createTableElement({
        columns: [
          { key: "value", label: "Value" },
        ],
        rows: [{ value: null }],
      }),
    );

    expect(bodyMarkup(html)).toContain("<td></td>");
    expect(bodyMarkup(html)).not.toContain("null");
  });

  it("renders missing cell keys as empty cells", () => {
    const html = renderTable(
      createTableElement({
        columns: [
          { key: "missing", label: "Missing" },
        ],
        rows: [{}],
      }),
    );

    expect(bodyMarkup(html)).toContain("<td></td>");
  });

  it("renders boolean cell values", () => {
    const html = renderTable(
      createTableElement({
        columns: [
          { key: "enabled", label: "Enabled" },
        ],
        rows: [
          { enabled: true },
          { enabled: false },
        ],
      }),
    );

    expect(bodyMarkup(html)).toContain("<td>true</td>");
    expect(bodyMarkup(html)).toContain("<td>false</td>");
  });

  it("renders numeric cell values including zero", () => {
    const html = renderTable(
      createTableElement({
        columns: [
          { key: "value", label: "Value" },
        ],
        rows: [
          { value: 42.5 },
          { value: 0 },
        ],
      }),
    );

    expect(bodyMarkup(html)).toContain("<td>42.5</td>");
    expect(bodyMarkup(html)).toContain("<td>0</td>");
  });

  it("escapes HTML in headers and cells", () => {
    const html = renderTable(
      createTableElement({
        columns: [
          {
            key: "value",
            label: '<Header title="unsafe">',
          },
        ],
        rows: [
          {
            value: '<script data-value="a&b">unsafe</script>',
          },
        ],
      }),
    );

    expect(html).not.toContain("<Header");
    expect(html).not.toContain("<script");
    expect(html).toContain(
      "&lt;Header title=&quot;unsafe&quot;&gt;",
    );
    expect(html).toContain(
      "&lt;script data-value=&quot;a&amp;b&quot;&gt;unsafe&lt;/script&gt;",
    );
  });

  it("renders nothing for a hidden table", () => {
    const html = renderTable(
      createTableElement({
        hidden: true,
        columns: [
          { key: "value", label: "Value" },
        ],
        rows: [{ value: "Hidden" }],
      }),
    );

    expect(html).toBe("");
  });
});
