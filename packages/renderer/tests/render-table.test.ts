import {
  describe,
  expect,
  it,
} from "vitest";

import {
  renderTable,
} from "../src/render-table";
import { renderElement } from "../src/render-element";

import {
  createTableElement,
} from "./fixtures/render-fixtures";

function bodyMarkup(html: string): string {
  const bodyStart = html.indexOf("<tbody>");
  const bodyEnd = html.indexOf("</tbody>");

  return html.slice(bodyStart, bodyEnd);
}

describe("renderTable", () => {
  it("renders RichText headers and cells while preserving scalar cells", () => {
    const html = renderTable(createTableElement({
      columns: [{ key: "name", label: { type: "rich-text", runs: [{ text: "Name", marks: { bold: true } }] } }],
      rows: [{ name: { type: "rich-text", runs: [{ text: "Alice", marks: { color: "#f00" } }] } }, { name: 42 }],
    }));

    expect(html).toContain("<strong>Name</strong>");
    expect(html).toContain("Alice");
    expect(html).toContain(">42</td>");
    expect(html).not.toContain("[object Object]");
  });
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

  it("leaves authored typography and color declarations absent by default", () => {
    const html = renderTable(createTableElement());

    expect(html).not.toContain("font-family:");
    expect(html).not.toContain("font-size:");
    expect(html).not.toContain("line-height:");
    expect(html).not.toContain("color:");
  });

  it("renders Simple Table typography and literal or palette colors on the table root", () => {
    const html = renderTable(createTableElement({
      typography: {
        fontFamily: 'Example "Mono"',
        fontSize: "1.25rem",
        lineHeight: 1.4,
      },
      style: { color: { kind: "palette", colorId: "accent" } },
    }));

    expect(html).toContain("font-family:&quot;Example \\22 Mono\\22 &quot;");
    expect(html).toContain("font-size:1.25rem");
    expect(html).toContain("line-height:1.4");
    expect(html).toContain("color:var(--ps-palette-0061006300630065006e0074)");

    const literal = renderTable(createTableElement({ style: { color: "#123456" } }));
    expect(literal).toContain("color:#123456");
  });

  it("coexists with canonical Simple Table styles", () => {
    const html = renderTable(createTableElement({
      layout: { position: "absolute", width: 320 },
      style: {
        background: { color: "#101218" },
        border: { width: 1, style: "solid", color: "#334155" },
        borderRadius: 8,
        color: "#f8fafc",
      },
      effect: { opacity: 0.8 },
      typography: { fontFamily: "Fira Code", fontSize: 16, lineHeight: 1.4 },
    }));

    expect(html).toContain("width:320px");
    expect(html).toContain("background:#101218");
    expect(html).toContain("border-radius:8px");
    expect(html).toContain("opacity:0.8");
    expect(html).toContain("font-size:16px");
    expect(html).toContain("line-height:1.4");
    expect(html).toContain("color:#f8fafc");
  });

  it("renders a Structured Table gradient border through the outer frame", () => {
    const html = renderElement({
      type: "table",
      id: "structured-gradient-border",
      mode: "structured",
      showHeader: true,
      hidden: false,
      style: {
        border: {
          width: 2,
          style: "solid",
          gradient: {
            type: "linear",
            angle: 90,
            stops: [
              { color: "#7c3aed", position: 0 },
              { color: "#06b6d4", position: 100 },
            ],
          },
        },
      },
      columns: [{ id: "column-1", header: { id: "header-1", children: [] } }],
      rows: [{ id: "row-1", cells: [{ id: "cell-1", children: [] }] }],
    });

    expect(html).toContain("--powershow-table-border-width:2px");
    expect(html).toContain("powershow-table-frame-gradient-border");
    expect(html).toContain("--powershow-table-border-gradient:linear-gradient(90deg,#7c3aed 0%,#06b6d4 100%)");
    expect(html).toContain("--powershow-table-border-width:2px");
    expect(html).not.toContain("border-image:");
  });

  it("fills an explicitly sized frame without changing intrinsic sizing", () => {
    const sized = renderElement({
      type: "table", id: "sized-table", mode: "structured", showHeader: true, hidden: false,
      layout: { width: 320, height: 180 },
      columns: [{ id: "column", header: { id: "header", children: [] } }],
      rows: [{ id: "row", cells: [{ id: "cell", children: [] }] }],
    });
    const intrinsic = renderElement({
      type: "table", id: "intrinsic-table", mode: "structured", showHeader: true, hidden: false,
      columns: [{ id: "column", header: { id: "header", children: [] } }],
      rows: [{ id: "row", cells: [{ id: "cell", children: [] }] }],
    });

    expect(sized).toContain('data-powershow-id="sized-table"');
    expect(sized).toContain('class="powershow-table powershow-table-structured powershow-table-fills-frame"');
    expect(sized).toContain("height:180px");
    expect(intrinsic).not.toContain("powershow-table-fills-frame");
  });

  it("keeps the gradient ring visual-only and above the inner surface", () => {
    const html = renderElement({
      type: "table", id: "ring-table", mode: "structured", showHeader: true, hidden: false,
      style: { border: { width: 3, style: "solid", gradient: { type: "linear", stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 100 }] } } },
      columns: [{ id: "column", header: { id: "header", children: [] } }],
      rows: [{ id: "row", cells: [{ id: "cell", children: [] }] }],
    });

    expect(html).toContain("powershow-table-frame-gradient-border");
    expect(html).not.toContain("border-image:");
  });

  it("derives the inner surface radius from the frame radius and border width", () => {
    const html = renderElement({
      type: "table", id: "rounded-table", mode: "structured", showHeader: true, hidden: false,
      style: {
        border: { width: 3, style: "solid", color: "#000" },
        borderRadius: 12,
      },
      columns: [{ id: "column", header: { id: "header", children: [] } }],
      rows: [{ id: "row", cells: [{ id: "cell", children: [] }] }],
    });

    expect(html).toContain("--powershow-table-frame-radius:12px");
    expect(html).toContain("--powershow-table-border-width:3px");
    expect(html).toContain("border-radius:12px");
    expect(html).toContain('data-powershow-id="rounded-table"');
  });

  it("renders structured tables with recursive semantic content", () => {
    const html = renderElement({
      type: "table",
      id: "structured-table",
      mode: "structured",
      showHeader: true,
      hidden: false,
      columns: [{
        id: "name-column",
        header: {
          id: "name-header",
          style: { className: "header-slot" },
          children: [{
            type: "text",
            id: "header-text",
            hidden: false,
            variant: "body",
            content: "Name",
          }],
        },
        width: 120,
      }],
      rows: [{
        id: "row-1",
        cells: [{
          id: "name-cell",
          style: { className: "cell-slot" },
          children: [{
            type: "container",
            id: "cell-container",
            hidden: false,
            layout: { children: { direction: "column" } },
            children: [{
              type: "text",
              id: "cell-text",
              hidden: false,
              variant: "body",
              content: "Alice & Bob",
            }],
          }],
        }],
      }],
    });

    expect(html).toContain("<colgroup>");
    expect(html).toContain('data-powershow-table-column-id="name-column"');
    expect(html).toContain('style="width:120px"');
    expect(html).toContain('<thead><tr><th scope="col"');
    expect(html).toContain('data-powershow-content-slot-id="name-header"');
    expect(html).toContain('data-powershow-content-slot-id="name-cell"');
    expect(html).toContain('class="header-slot"');
    expect(html).toContain('class="cell-slot"');
    expect(html).toContain('data-powershow-table-row-id="row-1"');
    expect(html).toContain('data-powershow-id="cell-container"');
    expect(html).toContain("Alice &amp; Bob");
  });

  it("omits thead but preserves structured headers when hidden", () => {
    const html = renderElement({
      type: "table",
      id: "no-header-table",
      mode: "structured",
      showHeader: false,
      hidden: false,
      columns: [{
        id: "column-1",
        header: { id: "header-1", children: [] },
      }],
      rows: [{ id: "row-1", cells: [{ id: "cell-1", children: [] }] }],
    });

    expect(html).not.toContain("<thead>");
    expect(html).toContain("data-powershow-id=\"no-header-table\"");
    expect(html).toContain("<tbody>");
  });

  it("renders semantic backgrounds with explicit slot precedence and divider opacity", () => {
    const html = renderElement({
      type: "table",
      id: "styled-table",
      mode: "structured",
      showHeader: true,
      hidden: false,
      style: {
        headerBackground: "#111111",
        bodyRowAlternateBackground: "#444444",
        dividerOpacity: 0.5,
      },
      columns: [{ id: "column-1", header: { id: "header-1", children: [] } }, { id: "column-2", header: { id: "header-2", children: [] } }],
      rows: [{ id: "row-1", cells: [{ id: "cell-1", children: [] }, { id: "cell-2", style: { background: { color: "#555555" } }, children: [] }] }, { id: "row-2", cells: [{ id: "cell-3", children: [] }, { id: "cell-4", children: [] }] }],
    });

    expect(html).toContain("--powershow-table-divider-opacity:0.5");
    expect(html).toContain('data-powershow-content-slot-id="header-1" data-powershow-table-column-id="column-1" style="background:#111111"');
    expect(html).not.toContain('data-powershow-content-slot-id="cell-1" style=');
    expect(html).toContain('data-powershow-content-slot-id="cell-2" style="background:#555555"');
    expect(html).toContain('data-powershow-content-slot-id="cell-4" style="background:#444444"');
  });

  it("includes an unoverridden visible header in zebra parity", () => {
    const html = renderElement({
      type: "table", id: "header-parity", mode: "structured", showHeader: true, hidden: false,
      style: { background: { color: "#101010" }, bodyRowAlternateBackground: "#202020" },
      columns: [{ id: "column", header: { id: "header", children: [] } }],
      rows: [
        { id: "row-1", cells: [{ id: "cell-1", children: [] }] },
        { id: "row-2", cells: [{ id: "cell-2", children: [] }] },
      ],
    });
    expect(html).toContain('class="powershow-table powershow-table-structured powershow-table-has-surface"');
    expect(html).not.toContain('data-powershow-content-slot-id="header" style=');
    expect(html).toContain('data-powershow-content-slot-id="cell-1" style="background:#202020"');
    expect(html).not.toContain('data-powershow-content-slot-id="cell-2" style=');
  });

  it("restarts body parity when the header has an explicit override", () => {
    const html = renderElement({
      type: "table", id: "header-override-parity", mode: "structured", showHeader: true, hidden: false,
      style: { background: { color: "#101010" }, headerBackground: "#303030", bodyRowAlternateBackground: "#202020" },
      columns: [{ id: "column", header: { id: "header", children: [] } }],
      rows: [
        { id: "row-1", cells: [{ id: "cell-1", children: [] }] },
        { id: "row-2", cells: [{ id: "cell-2", children: [] }] },
      ],
    });
    expect(html).toContain('data-powershow-content-slot-id="header" data-powershow-table-column-id="column" style="background:#303030"');
    expect(html).not.toContain('data-powershow-content-slot-id="cell-1" style=');
    expect(html).toContain('data-powershow-content-slot-id="cell-2" style="background:#202020"');
  });

  it("starts body parity at the first row when the header is hidden", () => {
    const html = renderElement({
      type: "table", id: "hidden-header-parity", mode: "structured", showHeader: false, hidden: false,
      style: { background: { color: "#101010" }, bodyRowAlternateBackground: "#202020" },
      columns: [{ id: "column", header: { id: "header", children: [] } }],
      rows: [
        { id: "row-1", cells: [{ id: "cell-1", children: [] }] },
        { id: "row-2", cells: [{ id: "cell-2", children: [] }] },
      ],
    });
    expect(html).not.toContain('data-powershow-content-slot-id="cell-1" style=');
    expect(html).toContain('data-powershow-content-slot-id="cell-2" style="background:#202020"');
  });

  it("lets semantic backgrounds fall through to the generic table surface", () => {
    const html = renderElement({
      type: "table", id: "fallback-table", mode: "structured", showHeader: true, hidden: false,
      style: { background: { color: "#101010" } },
      columns: [{ id: "column-1", header: { id: "header-1", children: [] } }],
      rows: [{ id: "row-1", cells: [{ id: "cell-1", children: [] }] }],
    });

    expect(html).toContain("powershow-table-has-surface");
    expect(html).toContain('style="background:#101010"');
    expect(html).not.toContain('data-powershow-content-slot-id="header-1" style=');
    expect(html).not.toContain('data-powershow-content-slot-id="cell-1" style=');
  });

  it("renders an explicitly transparent reset surface without a gradient", () => {
    const html = renderElement({
      type: "table", id: "transparent-table", mode: "structured", showHeader: true, hidden: false,
      style: { background: { color: "#00000000" }, bodyRowAlternateBackground: "#222222" },
      columns: [{ id: "column", header: { id: "header", children: [] } }],
      rows: [{ id: "row-1", cells: [{ id: "cell-1", children: [] }] }, { id: "row-2", cells: [{ id: "cell-2", children: [] }] }],
    });
    expect(html).toContain('style="background:#00000000"');
    expect(html).toContain('data-powershow-content-slot-id="cell-1" style="background:#222222"');
    expect(html).not.toContain('data-powershow-content-slot-id="cell-2" style=');
    expect(html).not.toContain("background-image:");
  });
});
