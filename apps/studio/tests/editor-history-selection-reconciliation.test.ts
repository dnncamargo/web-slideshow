import { describe, expect, it } from "vitest";

import { PresentationSchema } from "@powershow/document-schema";
import { reconcileSelectedElementAfterReplay } from "../src/features/editor/editor-history-selection-reconciliation";

describe("history selection reconciliation", () => {
  it("clears stale contentSlotId while retaining a surviving selected element", () => {
    const presentation = PresentationSchema.parse({
      schemaVersion: 1,
      id: "selection-reconciliation",
      title: "Selection reconciliation",
      slides: [{
        id: "slide-1",
        title: "Slide",
        elements: [{ type: "image", id: "image-1", hidden: false, src: "/image.png", alt: "Image" }],
      }],
    });

    expect(reconcileSelectedElementAfterReplay(
      { id: "image-1", type: "image", contentSlotId: "stale-slot" },
      presentation,
      0,
    )).toEqual({ id: "image-1", type: "image", contentSlotId: null });
  });
});
