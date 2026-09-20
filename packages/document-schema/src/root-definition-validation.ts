import type { Presentation } from "./presentation";
import type { PresentationElement } from "./elements";
import {
  collectRootDefinitionStructuralIds,
  findRootDefinitionContainers,
  listRootDefinitionStructuralIds,
} from "./root-definition";

type IssueContext = {
  addIssue: (issue: {
    code: "custom";
    path: (string | number)[];
    message: string;
  }) => void;
};

function addIssue(
  context: IssueContext,
  path: (string | number)[],
  message: string,
): void {
  context.addIssue({ code: "custom", path, message });
}

export function validatePresentationRootDefinitionReferences(
  presentation: Presentation,
  context: IssueContext,
): void {
  const definitions = presentation.rootDefinitions ?? [];
  const definitionsById = new Map<string, number>();

  definitions.forEach((definition, index) => {
    if (definitionsById.has(definition.id)) {
      addIssue(context, ["rootDefinitions", index, "id"], "Root Definition IDs must be unique.");
    }
    definitionsById.set(definition.id, index);
  });

  if (
    presentation.defaultRootDefinitionId !== undefined &&
    !definitionsById.has(presentation.defaultRootDefinitionId)
  ) {
    addIssue(
      context,
      ["defaultRootDefinitionId"],
      "Default Root Definition reference does not resolve.",
    );
  }

  const validateLocalIds = (
    masterIds: Set<string>,
    localIds: Set<string>,
    children: readonly PresentationElement[],
    path: (string | number)[],
  ): void => {
    children.forEach((child, childIndex) => {
      const childIds = listRootDefinitionStructuralIds(child);
      childIds.forEach((id) => {
        if (localIds.has(id) || masterIds.has(id)) {
          addIssue(
            context,
            [...path, childIndex, "id"],
            "Master-backed Slide materialization IDs must not collide.",
          );
        }
        localIds.add(id);
      });
    });
  };

  presentation.slides.forEach((slide, slideIndex) => {
    const rootDefinitionId = slide.rootDefinitionId ?? presentation.defaultRootDefinitionId;
    const definitionIndex = rootDefinitionId === undefined
      ? undefined
      : definitionsById.get(rootDefinitionId);
    const definition = definitionIndex === undefined ? undefined : definitions[definitionIndex];
    const local = slide.localRootChildren ?? [];

    if (slide.rootDefinitionId !== undefined && definition === undefined) {
      addIssue(
        context,
        ["slides", slideIndex, "rootDefinitionId"],
        "Slide Root Definition reference does not resolve.",
      );
    }

    if (definition === undefined) {
      if (local.length > 0) {
        addIssue(
          context,
          ["slides", slideIndex, "localRootChildren"],
          "Root-Definition-local contribution requires an effective Root Definition.",
        );
      }
      return;
    }

    if (slide.elements.length > 0) {
      addIssue(
        context,
        ["slides", slideIndex, "elements"],
        "Master-backed Slides must not contain ordinary slide.elements content.",
      );
    }

    const masterIds = collectRootDefinitionStructuralIds(definition.root);
    const containers = findRootDefinitionContainers(definition.root);
    const authorizedTargets = new Set(definition.localChildTargetIds ?? []);
    const localTargets = new Set<string>();
    const localIds = new Set<string>();

    local.forEach((record, recordIndex) => {
      if (localTargets.has(record.targetContainerId)) {
        addIssue(
          context,
          ["slides", slideIndex, "localRootChildren", recordIndex, "targetContainerId"],
          "Slide local-child target records must be unique.",
        );
      }
      localTargets.add(record.targetContainerId);

      if (!authorizedTargets.has(record.targetContainerId) || !containers.has(record.targetContainerId)) {
        addIssue(
          context,
          ["slides", slideIndex, "localRootChildren", recordIndex, "targetContainerId"],
          "Slide local-child target is not authorized by the effective Root Definition.",
        );
      }

      validateLocalIds(
        masterIds,
        localIds,
        record.children,
        ["slides", slideIndex, "localRootChildren", recordIndex, "children"],
      );
    });
  });
}
