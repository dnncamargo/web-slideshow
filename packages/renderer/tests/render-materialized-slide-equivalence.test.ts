import { describe, expect, it } from "vitest";

import {
  materializeSlide,
  PresentationSchema,
  type ContainerElement,
  type ContentSlot,
  type Presentation,
  type PresentationElement,
  type SlideLocalRootChildren,
} from "@web-slideshow/document-schema";

import { renderSlide } from "../src/render-slide";

function text(
  id: string,
  content = id,
  overrides: Record<string, unknown> = {},
): PresentationElement {
  return {
    id,
    type: "text",
    hidden: false,
    variant: "body",
    content,
    ...overrides,
  } as PresentationElement;
}

function container(
  id: string,
  children: PresentationElement[] = [],
  overrides: Record<string, unknown> = {},
): ContainerElement {
  return {
    id,
    type: "container",
    hidden: false,
    children,
    ...overrides,
  } as ContainerElement;
}

function slot(id: string, children: PresentationElement[] = []): ContentSlot {
  return { id, children };
}

function createPresentation(
  slide: Record<string, unknown>,
  extras: Record<string, unknown> = {},
): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "renderer-equivalence",
    title: "Renderer equivalence",
    aspectRatio: "16:9",
    ...extras,
    slides: [slide],
  });
}

function createEquivalentPresentations(
  legacyRoot: ContainerElement,
  masterRoot: ContainerElement,
  localRootChildren: SlideLocalRootChildren[] = [],
  extras: Record<string, unknown> = {},
): { legacy: Presentation; referential: Presentation } {
  const slideId = "equivalent-slide";
  const rootDefinitionId = "equivalent-master";

  const legacy = createPresentation(
    {
      id: slideId,
      elements: [legacyRoot],
    },
    extras,
  );

  const referential = createPresentation(
    {
      id: slideId,
      rootDefinitionId,
      elements: [],
      ...(localRootChildren.length > 0 ? { localRootChildren } : {}),
    },
    {
      ...extras,
      rootDefinitions: [{
        id: rootDefinitionId,
        name: "Equivalent master",
        root: masterRoot,
        ...(localRootChildren.length > 0
          ? { localChildTargetIds: localRootChildren.map((entry) => entry.targetContainerId) }
          : {}),
      }],
    },
  );

  return { legacy, referential };
}

function renderEquivalent(
  legacy: Presentation,
  referential: Presentation,
): { legacyHtml: string; materializedHtml: string; materialized: ReturnType<typeof materializeSlide> } {
  const legacySlide = legacy.slides[0];
  const referentialSlide = referential.slides[0];
  if (!legacySlide || !referentialSlide) {
    throw new Error("Equivalence fixture must contain one slide.");
  }

  const materialized = materializeSlide(referential, referentialSlide);

  return {
    legacyHtml: renderSlide(legacySlide, { presentation: legacy }),
    materializedHtml: renderSlide(materialized.slide, { presentation: referential }),
    materialized,
  };
}

function paletteReference() {
  return { kind: "palette" as const, colorId: "accent" };
}

function equivalentCases(): Array<{
  name: string;
  create: () => { legacy: Presentation; referential: Presentation };
}> {
  return [
    {
      name: "renders a simple Root Container and Text equivalently",
      create: () => {
        const root = container("root", [text("master-text", "Hello")]);
        return createEquivalentPresentations(root, root);
      },
    },
    {
      name: "preserves Master children before appended Slide-local children",
      create: () => createEquivalentPresentations(
        container("root", [text("master-text"), text("local-text")]),
        container("root", [text("master-text")]),
        [{ targetContainerId: "root", children: [text("local-text")] }],
      ),
    },
    {
      name: "materializes and renders a nested Container target equivalently",
      create: () => createEquivalentPresentations(
        container("root", [
          container("nested-target", [text("master-text"), text("local-text")]),
        ]),
        container("root", [
          container("nested-target", [text("master-text")]),
        ]),
        [{ targetContainerId: "nested-target", children: [text("local-text")] }],
      ),
    },
    {
      name: "resolves a linked style on a Master-owned Container equally",
      create: () => {
        const linkedStyle = {
          id: "master-card",
          name: "Master card",
          layout: { padding: 12, children: { direction: "row", gap: 8 } },
          style: {
            color: paletteReference(),
            background: { color: "#101827" },
          },
        };
        const root = (children: PresentationElement[]) => container("root", children);
        const linked = (children: PresentationElement[]) => container(
          "master-card-container",
          children,
          { linkedStyleId: "master-card" },
        );

        return createEquivalentPresentations(
          root([linked([text("master-text")])]),
          root([linked([text("master-text")])]),
          [],
          {
            palette: { colors: [{ id: "accent", name: "Accent", value: "#facc15" }] },
            linkedStyles: [linkedStyle],
          },
        );
      },
    },
    {
      name: "resolves Text Styles on both Master and Slide-owned Text equally",
      create: () => createEquivalentPresentations(
        container("root", [
          text("master-text", "Master", { variant: "title" }),
          text("local-text", "Local", { variant: "title" }),
        ]),
        container("root", [
          text("master-text", "Master", { variant: "title" }),
        ]),
        [{ targetContainerId: "root", children: [text("local-text", "Local", { variant: "title" })] }],
        {
          textStyles: [{
            id: "title",
            style: { color: "#facc15" },
            typography: { fontSize: 30, fontWeight: 700 },
          }],
        },
      ),
    },
    {
      name: "preserves layout, style, slide background, and palette references",
      create: () => {
        const accent = paletteReference();
        const localText = text("local-text", "Local", {
          style: { color: accent },
          layout: { position: "absolute", left: 24, top: 12 },
        });
        const masterRoot = container("root", [
          container("content", [text("master-text")], {
            role: "main",
            layout: { padding: 16, children: { direction: "row", gap: 10 } },
            style: { color: accent, background: { color: accent } },
          }),
        ]);
        const legacyRoot = container("root", [
          container("content", [text("master-text"), localText], {
            role: "main",
            layout: { padding: 16, children: { direction: "row", gap: 10 } },
            style: { color: accent, background: { color: accent } },
          }),
        ]);

        return createEquivalentPresentations(
          legacyRoot,
          masterRoot,
          [{ targetContainerId: "content", children: [localText] }],
          {
            palette: { colors: [{ id: "accent", name: "Accent", value: "#facc15" }] },
          },
        );
      },
    },
    {
      name: "renders a structured Table containing a target Container equivalently",
      create: () => {
        const table = (target: ContainerElement): PresentationElement => ({
          id: "table",
          type: "table",
          hidden: false,
          mode: "structured",
          showHeader: true,
          columns: [{ id: "column", header: slot("header", [target]) }],
          rows: [{ id: "row", cells: [slot("cell")] }],
        } as PresentationElement);

        return createEquivalentPresentations(
          container("root", [table(container("table-target", [text("master-text"), text("local-text")]))]),
          container("root", [table(container("table-target", [text("master-text")]))]),
          [{ targetContainerId: "table-target", children: [text("local-text")] }],
        );
      },
    },
    {
      name: "renders Topics containing a target Container equivalently",
      create: () => {
        const topics = (target: ContainerElement): PresentationElement => ({
          id: "topics",
          type: "topics",
          hidden: false,
          kind: "unordered",
          items: [{
            id: "topic-item",
            content: slot("topic-content", [target]),
            children: [],
          }],
        } as PresentationElement);

        return createEquivalentPresentations(
          container("root", [topics(container("topics-target", [text("master-text"), text("local-text")]))]),
          container("root", [topics(container("topics-target", [text("master-text")]))]),
          [{ targetContainerId: "topics-target", children: [text("local-text")] }],
        );
      },
    },
    {
      name: "keeps hidden elements absent from both rendered trees",
      create: () => createEquivalentPresentations(
        container("root", [
          text("hidden-master", "Hidden master", { hidden: true }),
          text("visible-master", "Visible master"),
          text("hidden-local", "Hidden local", { hidden: true }),
        ]),
        container("root", [
          text("hidden-master", "Hidden master", { hidden: true }),
          text("visible-master", "Visible master"),
        ]),
        [{ targetContainerId: "root", children: [text("hidden-local", "Hidden local", { hidden: true })] }],
      ),
    },
  ];
}

describe("materialized slide renderer equivalence", () => {
  it.each(equivalentCases())("$name", ({ create }) => {
    const { legacy, referential } = create();
    const { legacyHtml, materializedHtml } = renderEquivalent(legacy, referential);

    expect(materializedHtml).toBe(legacyHtml);
  });

  it("preserves canonical IDs and emits no Root Definition-specific markup", () => {
    const { legacy, referential } = createEquivalentPresentations(
      container("root", [text("master-text"), text("local-text")]),
      container("root", [text("master-text")]),
      [{ targetContainerId: "root", children: [text("local-text")] }],
    );
    const { legacyHtml, materializedHtml, materialized } = renderEquivalent(legacy, referential);
    const identityMarkers = (html: string): string[] =>
      [...html.matchAll(/data-presentation-id="([^"]+)"/g)].map((match) => match[1] ?? "");

    expect(identityMarkers(materializedHtml)).toEqual(identityMarkers(legacyHtml));
    expect(materializedHtml).toContain('data-presentation-id="root"');
    expect(materializedHtml).toContain('data-presentation-id="master-text"');
    expect(materializedHtml).toContain('data-presentation-id="local-text"');
    expect(materializedHtml).not.toMatch(/rootDefinition|localRootChildren|ownershipByStructuralId/);
    expect(materialized.slide).not.toHaveProperty("rootDefinitionId");
    expect(materialized.slide).not.toHaveProperty("localRootChildren");
  });
});
