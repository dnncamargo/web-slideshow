import { describe, expect, it } from "vitest";

import { PresentationElementSchema } from "../src/elements";

function createContainer(layoutMode?: "flow" | "stack") {
  return {
    type: "container",
    id: "container",
    hidden: false,
    ...(layoutMode === undefined ? {} : { layout: { children: { mode: layoutMode } } }),
    children: [],
  };
}

describe("container layout mode", () => {
  it("accepts containers without a layout mode", () => {
    expect(PresentationElementSchema.safeParse(createContainer()).success).toBe(true);
  });

  it.each(["flow", "stack"] as const)("accepts %s layout mode", (layoutMode) => {
    expect(PresentationElementSchema.safeParse(createContainer(layoutMode)).success).toBe(
      true,
    );
  });

  it("rejects an invalid layout mode", () => {
    expect(
      PresentationElementSchema.safeParse({
        ...createContainer(),
        layout: { children: { mode: "layered" } },
      }).success,
    ).toBe(false);
  });

  it("accepts nested stack containers", () => {
    expect(
      PresentationElementSchema.safeParse({
        ...createContainer("stack"),
        children: [
          {
            ...createContainer("stack"),
            id: "nested-container",
          },
        ],
      }).success,
    ).toBe(true);
  });
});
