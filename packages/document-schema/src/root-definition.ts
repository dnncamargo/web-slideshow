import { z } from "zod";

import {
  ContainerElementSchema,
  PresentationElementSchema,
  type ContentSlot,
  type ContainerElement,
  type PresentationElement,
  type TopicItem,
} from "./elements";
import { ElementIdSchema } from "./primitives";

const NonEmptyTrimmedStringSchema = z.string().trim().min(1);

function visitSlot(
  slot: ContentSlot,
  visit: (element: PresentationElement) => void,
): void {
  slot.children.forEach((child) => visitElement(child, visit));
}

function visitTopicItem(
  item: TopicItem,
  visit: (element: PresentationElement) => void,
): void {
  visitSlot(item.content, visit);
  item.children.forEach((child) => visitTopicItem(child, visit));
}

function visitElement(
  element: PresentationElement,
  visit: (element: PresentationElement) => void,
): void {
  visit(element);

  if (element.type === "container") {
    element.children.forEach((child) => visitElement(child, visit));
  } else if (element.type === "table" && element.mode === "structured") {
    element.columns.forEach((column) => visitSlot(column.header, visit));
    element.rows.forEach((row) => row.cells.forEach((cell) => visitSlot(cell, visit)));
  } else if (element.type === "topics") {
    element.items.forEach((item) => visitTopicItem(item, visit));
  }
}

/** Collects element and nested structural IDs in a Root Definition tree. */
export function listRootDefinitionStructuralIds(
  root: PresentationElement,
): string[] {
  const ids: string[] = [];

  visitElement(root, (element) => {
    ids.push(element.id);

    if (element.type === "table" && element.mode === "structured") {
      element.columns.forEach((column) => {
        ids.push(column.id);
        ids.push(column.header.id);
      });
      element.rows.forEach((row) => {
        ids.push(row.id);
        row.cells.forEach((cell) => ids.push(cell.id));
      });
    }

    if (element.type === "topics") {
      const collectTopicIds = (item: TopicItem): void => {
        ids.push(item.id);
        ids.push(item.content.id);
        item.children.forEach(collectTopicIds);
      };
      element.items.forEach(collectTopicIds);
    }
  });

  return ids;
}

export function collectRootDefinitionStructuralIds(
  root: PresentationElement,
): Set<string> {
  return new Set(listRootDefinitionStructuralIds(root));
}

/** Finds Container IDs, including Containers nested in table/topic content. */
export function findRootDefinitionContainers(
  root: PresentationElement,
): Map<string, ContainerElement> {
  const containers = new Map<string, ContainerElement>();
  visitElement(root, (element) => {
    if (element.type === "container") {
      containers.set(element.id, element);
    }
  });
  return containers;
}

function validateRootDefinitionTree(
  definition: { root: ContainerElement; localChildTargetIds?: string[] | undefined },
  context: z.RefinementCtx,
): void {
  const ids = new Set<string>();
  const duplicateIds = new Set<string>();
  visitElement(definition.root, (element) => {
    const structuralIds = [element.id];
    if (element.type === "table" && element.mode === "structured") {
      structuralIds.push(
        ...element.columns.flatMap((column) => [column.id, column.header.id]),
        ...element.rows.flatMap((row) => [row.id, ...row.cells.map((cell) => cell.id)]),
      );
    }
    if (element.type === "topics") {
      const topicIds = (items: TopicItem[]): string[] => items.flatMap((item) => [
        item.id,
        item.content.id,
        ...topicIds(item.children),
      ]);
      structuralIds.push(...topicIds(element.items));
    }
    structuralIds.forEach((id) => {
      if (ids.has(id)) duplicateIds.add(id);
      ids.add(id);
    });
  });

  if (duplicateIds.size > 0) {
    context.addIssue({
      code: "custom",
      path: ["root"],
      message: "Root Definition structural IDs must be unique.",
    });
  }

  const targets = definition.localChildTargetIds ?? [];
  const seenTargets = new Set<string>();
  const containers = findRootDefinitionContainers(definition.root);
  targets.forEach((target, index) => {
    if (seenTargets.has(target)) {
      context.addIssue({
        code: "custom",
        path: ["localChildTargetIds", index],
        message: "Root Definition local-child target IDs must be unique.",
      });
    }
    seenTargets.add(target);

    if (!containers.has(target)) {
      context.addIssue({
        code: "custom",
        path: ["localChildTargetIds", index],
        message: "Root Definition local-child target must resolve to a Container.",
      });
    }
  });
}

export const RootDefinitionSchema = z.object({
  id: NonEmptyTrimmedStringSchema,
  name: NonEmptyTrimmedStringSchema,
  root: ContainerElementSchema,
  localChildTargetIds: z.array(ElementIdSchema).optional(),
}).strict().superRefine(validateRootDefinitionTree);

export type RootDefinition = z.infer<typeof RootDefinitionSchema>;

export const SlideLocalRootChildrenSchema = z.object({
  targetContainerId: ElementIdSchema,
  children: z.array(PresentationElementSchema).min(1),
}).strict();

export type SlideLocalRootChildren = z.infer<typeof SlideLocalRootChildrenSchema>;
