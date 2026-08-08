import {
  describe,
  expect,
  it,
} from "vitest";

import {
  renderElement,
} from "../src/render-element";

import {
  createCodeElement,
  createContainerElement,
  createTableElement,
  createTerminalElement,
  createTextElement,
} from "./fixtures/render-fixtures";

function countOccurrences(
  value: string,
  search: string,
): number {
  return value.split(search).length - 1;
}

describe("recursive container rendering", () => {
  it("renders containers nested four levels deep", () => {
    const element = createContainerElement({
      id: "level-1",
      children: [
        createContainerElement({
          id: "level-2",
          children: [
            createContainerElement({
              id: "level-3",
              children: [
                createContainerElement({
                  id: "level-4",
                  children: [
                    createTextElement({
                      id: "deep-text",
                      content: "Deep content",
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    const html = renderElement(element);

    expect(
      countOccurrences(
        html,
        'data-powershow-type="container"',
      ),
    ).toBe(4);
    expect(html).toContain('data-powershow-id="deep-text"');
    expect(html).toContain("Deep content");
  });

  it("renders mixed content across nested containers", () => {
    const element = createContainerElement({
      id: "mixed-root",
      direction: "row",
      children: [
        createContainerElement({
          id: "content-column",
          children: [
            createTextElement({ id: "nested-text" }),
            createCodeElement({ id: "nested-code" }),
          ],
        }),
        createContainerElement({
          id: "data-column",
          children: [
            createTerminalElement({
              id: "nested-terminal",
            }),
            createTableElement({
              id: "nested-table",
            }),
          ],
        }),
      ],
    });

    const html = renderElement(element);

    for (const type of [
      "text",
      "code",
      "terminal",
      "table",
    ]) {
      expect(html).toContain(
        `data-powershow-type="${type}"`,
      );
    }
  });

  it("omits hidden nested elements while preserving visible siblings", () => {
    const element = createContainerElement({
      id: "visibility-root",
      children: [
        createTextElement({
          id: "visible-text",
          content: "Visible content",
        }),
        createTextElement({
          id: "hidden-text",
          hidden: true,
          content: "Hidden content",
        }),
        createContainerElement({
          id: "hidden-container",
          hidden: true,
          children: [
            createTextElement({
              id: "hidden-descendant",
              content: "Hidden descendant",
            }),
          ],
        }),
      ],
    });

    const html = renderElement(element);

    expect(html).toContain("Visible content");
    expect(html).not.toContain("Hidden content");
    expect(html).not.toContain("Hidden descendant");
    expect(html).not.toContain('data-powershow-id="hidden-text"');
    expect(html).not.toContain(
      'data-powershow-id="hidden-container"',
    );
  });

  it("maps style-based row alignment to main and cross axes", () => {
    const html = renderElement(
      createContainerElement({
        direction: "row",
        style: {
          horizontalAlign: "end",
          verticalAlign: "stretch",
        },
      }),
    );

    expect(html).toContain("justify-content:flex-end");
    expect(html).toContain("align-items:stretch");
  });

  it("maps style-based column alignment to cross and main axes", () => {
    const html = renderElement(
      createContainerElement({
        direction: "column",
        style: {
          horizontalAlign: "start",
          verticalAlign: "center",
        },
      }),
    );

    expect(html).toContain("align-items:flex-start");
    expect(html).toContain("justify-content:center");
  });
});
