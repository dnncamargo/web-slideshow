// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TopicsElement } from "@powershow/document-schema";

import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { TopicsInspector } from "../src/features/editor/inspector/topics-inspector";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function topicsElement(
  overrides: Partial<Omit<TopicsElement, "type">> = {},
): TopicsElement {
  return {
    type: "topics",
    id: "topics-1",
    hidden: false,
    kind: "unordered",
    items: [
      {
        id: "topic-a",
        content: {
          id: "slot-a",
          children: [
            {
              type: "text",
              id: "topic-a-text",
              hidden: false,
              variant: "body",
              content: "New topic",
            },
          ],
        },
        children: [],
      },
      {
        id: "topic-b",
        content: {
          id: "slot-b",
          children: [
            {
              type: "text",
              id: "topic-b-text",
              hidden: false,
              variant: "body",
              content: "New topic",
            },
          ],
        },
        children: [],
      },
    ],
    ...overrides,
  };
}

describe("TopicsInspector", () => {
  let container: HTMLDivElement;
  let root: Root;
  let elementState: TopicsElement;
  let updates: TopicsElement[];
  let addTopic: ReturnType<typeof vi.fn>;

  function renderInspector() {
    root.render(
      <StudioI18nProvider>
        <TopicsInspector
          element={elementState}
          onUpdate={(update) => {
            const next = update(elementState);
            if (next.type !== "topics") {
              return;
            }
            elementState = next;
            updates.push(elementState);
            renderInspector();
          }}
          topicsAuthoringControls={{
            onAddTopLevelTopic: addTopic,
          }}
        />
      </StudioI18nProvider>,
    );
  }

  function mount(initial: TopicsElement) {
    elementState = initial;
    updates = [];
    addTopic = vi.fn();
    renderInspector();
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  function kindSelect(): HTMLSelectElement {
    const select = container.querySelector<HTMLSelectElement>("#topics-kind");
    if (!select) {
      throw new Error("topics-kind select not found");
    }
    return select;
  }

  it("mounting the inspector performs no document write", async () => {
    await act(async () => {
      mount(topicsElement());
    });

    expect(updates).toHaveLength(0);
  });

  it("displays the unordered state", async () => {
    await act(async () => {
      mount(topicsElement());
    });

    expect(kindSelect().value).toBe("unordered");
  });

  it("changes unordered to ordered through onUpdate", async () => {
    await act(async () => {
      mount(topicsElement());
    });

    await act(async () => {
      kindSelect().value = "ordered";
      kindSelect().dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.kind).toBe("ordered");
    expect(updates[0]?.items).toHaveLength(2);
  });

  it("displays the correct top-level item count", async () => {
    await act(async () => {
      mount(topicsElement());
    });

    const text = container.textContent ?? "";
    expect(text).toContain("2 topics");
  });

  it("Add Topic invokes the structural callback with the selected Topics id", async () => {
    await act(async () => {
      mount(topicsElement());
    });

    const button = Array.from(
      container.querySelectorAll("button"),
    ).find((b) => b.textContent?.includes("Add topic"));

    expect(button).toBeDefined();

    await act(async () => {
      button?.click();
    });

    expect(addTopic).toHaveBeenCalledTimes(1);
    expect(addTopic).toHaveBeenCalledWith("topics-1");
  });
});
