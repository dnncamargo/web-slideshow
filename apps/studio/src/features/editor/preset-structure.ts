import type {
  ContainerElement,
  PresentationElement,
  TextElement,
} from "@web-slideshow/document-schema";

export type SlideLayoutPreset =
  | "blank"
  | "full"
  | "centered"
  | "title-content"
  | "two-columns"
  | "three-columns"
  | "title-two-columns";

/** Allocates a deterministic globally unique authoring id. */
export function createUniqueId(
  baseId: string,
  usedIds: Set<string>,
): string {
  let id = baseId;
  let suffix = 2;

  while (usedIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(id);
  return id;
}

/**
 * Builds only the structural tree for a layout preset.
 *
 * The structural owner is deliberately supplied by the caller so this same
 * tree can be used by Slide and Root Definition creation without introducing
 * owner-specific semantics into the preset implementation.
 */
export function buildPresetStructure(
  preset: SlideLayoutPreset,
  structuralOwnerId: string,
  usedIds: Set<string>,
): ContainerElement | null {
  function elementId(name: string): string {
    return createUniqueId(`${structuralOwnerId}-${name}`, usedIds);
  }

  function container(
    name: string,
    layout: NonNullable<ContainerElement["layout"]>,
    children: PresentationElement[] = [],
    style?: ContainerElement["style"],
  ): ContainerElement {
    return {
      id: elementId(name),
      type: "container",
      hidden: false,
      layout,
      ...(style === undefined ? {} : { style }),
      children,
    };
  }

  const text = (name: string, content: string): TextElement => ({
    id: elementId(name),
    type: "text",
    hidden: false,
    variant: "title",
    content,
  });

  switch (preset) {
    case "blank":
      return null;

    case "full":
      return container("root", {
        width: "100%",
        height: "100%",
        padding: 56,
        children: { direction: "column", gap: 24, horizontalAlign: "stretch", verticalAlign: "stretch" },
      }, [
        text("title", "Slide title"),
        container("content", {
          width: "100%",
          height: "100%",
          children: { direction: "column", gap: 16, horizontalAlign: "center", verticalAlign: "center" },
        }, [
          {
            id: elementId("content-body"),
            type: "text",
            hidden: false,
            variant: "body",
            content: "Add your content here.",
          },
        ]),
      ]);

    case "centered":
      return container("root", {
        width: "100%",
        height: "100%",
        padding: 64,
        children: { direction: "column", gap: 20, horizontalAlign: "center", verticalAlign: "center" },
      }, [
        text("title", "Centered slide"),
        container("content", {
          width: "70%",
          children: { direction: "column", gap: 16, horizontalAlign: "center", verticalAlign: "center" },
        }, [
          {
            id: elementId("content-body"),
            type: "text",
            hidden: false,
            variant: "body",
            content: "Add your content here.",
          },
        ]),
      ]);

    case "title-content":
      return container("root", {
        width: "100%",
        height: "100%",
        padding: 56,
        children: { direction: "column", gap: 32, horizontalAlign: "center", verticalAlign: "center" },
      }, [
        text("title", "Slide title"),
        container("content", {
          width: "90%",
          height: "68%",
          padding: 32,
          children: { direction: "column", gap: 16, horizontalAlign: "center", verticalAlign: "center" },
        }, [
          {
            id: elementId("body"),
            type: "text",
            hidden: false,
            variant: "body",
            content: "Add your content here.",
          },
        ], { background: { color: "rgba(15, 23, 42, 0.45)" } }),
      ]);

    case "two-columns": {
      const column = (name: string): ContainerElement => container(name, {
        width: "47%",
        height: "82%",
        padding: 24,
        children: { direction: "column", gap: 16, horizontalAlign: "center", verticalAlign: "center" },
      }, [], { background: { color: "rgba(15, 23, 42, 0.45)" } });
      return container("root", {
        width: "100%",
        height: "100%",
        padding: 48,
        children: { direction: "row", gap: 32, horizontalAlign: "center", verticalAlign: "center" },
      }, [column("left"), column("right")]);
    }

    case "three-columns": {
      const column = (name: string): ContainerElement => container(name, {
        width: "30%",
        height: "82%",
        padding: 20,
        children: { direction: "column", gap: 16, horizontalAlign: "center", verticalAlign: "center" },
      }, [], { background: { color: "rgba(15, 23, 42, 0.45)" } });
      return container("root", {
        width: "100%",
        height: "100%",
        padding: 48,
        children: { direction: "row", gap: 24, horizontalAlign: "center", verticalAlign: "center" },
      }, [column("column-1"), column("column-2"), column("column-3")]);
    }

    case "title-two-columns": {
      const column = (name: string): ContainerElement => container(name, {
        width: "48%",
        height: "100%",
        padding: 24,
        children: { direction: "column", gap: 16, horizontalAlign: "center", verticalAlign: "center" },
      }, [], { background: { color: "rgba(15, 23, 42, 0.45)" } });
      return container("root", {
        width: "100%",
        height: "100%",
        padding: 48,
        children: { direction: "column", gap: 28, horizontalAlign: "center", verticalAlign: "center" },
      }, [
        text("title", "Slide title"),
        container("columns", {
          width: "94%",
          height: "70%",
          children: { direction: "row", gap: 28, horizontalAlign: "center", verticalAlign: "center" },
        }, [column("left"), column("right")]),
      ]);
    }
  }
}

/** Creates the canonical one-container shape required by a Root Definition. */
export function createRootPresetContainer(
  preset: SlideLayoutPreset,
  rootDefinitionId: string,
  usedIds: Set<string>,
): ContainerElement {
  return buildPresetStructure(preset, rootDefinitionId, usedIds) ?? {
    id: createUniqueId(`${rootDefinitionId}-root`, usedIds),
    type: "container",
    hidden: false,
    children: [],
  };
}
