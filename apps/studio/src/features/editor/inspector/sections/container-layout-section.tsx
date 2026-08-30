import type { ContainerElement } from "@powershow/document-schema";
import type { Presentation } from "@powershow/document-schema";
import { useEffect, useState } from "react";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import {
  type UpdateContainer,
  updateContainerLayoutMode,
} from "../container-inspector-helpers";
import type { ContainerFitMode } from "../../container-fit-authoring";

import { InspectorSection } from "../inspector-section";
import { getContainerShareablePropertySource } from "../linked-style-inspector";
import { ContainerLinkedPropertyMeta } from "./container-linked-property-meta";

type ContainerDistribution = "packed" | "space-between" | "space-around" | "space-evenly";

type ContainerDirection = "row" | "column";

type ContainerLayoutMode = "flow" | "stack";

type ContainerOverflow = "visible" | "hidden" | "auto";

type ContainerHorizontalAlign = "start" | "center" | "end" | "stretch";

type ContainerVerticalAlign = "start" | "center" | "end" | "stretch";

interface ContainerLayoutSectionProps {
  element: ContainerElement;
  localElement?: ContainerElement;
  presentation?: Pick<Presentation, "linkedStyles">;

  onUpdate: UpdateContainer;

  onContainerFitModeChange: (mode: ContainerFitMode | null) => boolean;
}

// ============================================================
// BEGIN: CONTAINER LAYOUT SECTION
// ============================================================

export function ContainerLayoutSection({
  element,
  localElement = element,
  presentation,
  onUpdate,
  onContainerFitModeChange,
}: ContainerLayoutSectionProps) {
  const { t } = useStudioI18n();
  const [fitError, setFitError] = useState(false);

  useEffect(() => {
    setFitError(false);
  }, [element.id]);

  const hasDistributedMainAxis =
    (element.layout?.children?.distribution ?? "packed") !== "packed";
  const isStack = element.layout?.children?.mode === "stack";
  const linked = presentation?.linkedStyles?.find((style) => style.id === localElement.linkedStyleId);
  const linkedMode = linked?.layout?.children?.mode;
  const linkedDirection = linked?.layout?.children?.direction;
  const linkedDistribution = linked?.layout?.children?.distribution;
  const linkedOverflow = linked?.layout?.overflow;
  const linkedHorizontalAlign = linked?.layout?.children?.horizontalAlign;
  const linkedVerticalAlign = linked?.layout?.children?.verticalAlign;
  const source = (property: Parameters<typeof getContainerShareablePropertySource>[2]) => getContainerShareablePropertySource(presentation, localElement, property);
  const linkedFit = linked?.layout?.children?.fit;

  const isHorizontalAlignmentDisabled =
    element.layout?.children?.direction === "row" && hasDistributedMainAxis;

  const isVerticalAlignmentDisabled =
    (element.layout?.children?.direction ?? "column") === "column" && hasDistributedMainAxis;

  return (
    <InspectorSection title={t("inspector.layout")} defaultOpen>
      <label className={styles.field}>
        <span title={t("inspector.layoutModeHelp")}>{t("inspector.layoutMode")}</span>

        <select
          id="container-layout-mode"
          name="containerLayoutMode"
          value={element.layout?.children?.mode ?? "flow"}
          onChange={(event) => {
            const layoutMode = event.target.value as ContainerLayoutMode;

            onUpdate((container) =>
              linkedMode !== undefined
                ? { ...container, layout: { ...container.layout, children: { ...container.layout?.children, mode: layoutMode } } }
                : updateContainerLayoutMode(container, layoutMode),
            );
          }}
        >
          <option value="flow">{t("inspector.flow")}</option>

          <option value="stack">{t("inspector.stack")}</option>
        </select>
      </label>
      <ContainerLinkedPropertyMeta source={source("layout.children.mode").source} onReset={source("layout.children.mode").source === "local" && source("layout.children.mode").linkedValue !== undefined ? () => onUpdate((container) => ({ ...container, layout: { ...container.layout, children: { ...container.layout?.children, mode: undefined } } })) : undefined} />

      <label className={styles.field}>
        <span title={t("inspector.childrenFitHelp")}>{t("inspector.childrenFit")}</span>
        <select
          id="container-children-fit"
          name="containerChildrenFit"
          value={element.layout?.children?.fit?.mode ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            const mode = value === "" ? null : (value as ContainerFitMode);
            const accepted = onContainerFitModeChange(mode);
            setFitError(!accepted && mode !== null);
            if (accepted || mode === null) return;
          }}
        >
          {linkedFit === undefined && <option value="">{t("inspector.childrenFit.none")}</option>}
          <option value="contain">{t("inspector.childrenFit.contain")}</option>
          <option value="cover">{t("inspector.childrenFit.cover")}</option>
          <option value="fill">{t("inspector.childrenFit.fill")}</option>
        </select>
      </label>
      <ContainerLinkedPropertyMeta source={source("layout.children.fit").source} onReset={source("layout.children.fit").source === "local" && source("layout.children.fit").linkedValue !== undefined ? () => onContainerFitModeChange(null) : undefined} />
      <p className={styles.inspectorHint}>{t("inspector.childrenFitHelp")}</p>
      {fitError && (
        <p className={styles.inspectorError} role="status">
          {t("inspector.childrenFitMeasurementError")}
        </p>
      )}

      <label className={styles.field}>
        <span title={t("inspector.overflowHelp")}>{t("inspector.overflow")}</span>

        <select
          id="container-overflow"
          name="containerOverflow"
          value={element.layout?.overflow ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "" && linkedOverflow !== undefined) return;
            const overflow = value === "" ? undefined : (value as ContainerOverflow);

            onUpdate((container) => ({
              ...container,
              layout: { ...container.layout, overflow },
            }));
          }}
        >
          <option value="">{t("inspector.overflow.default")}</option>

          <option value="visible">{t("inspector.overflow.visible")}</option>

          <option value="hidden">{t("inspector.overflow.hidden")}</option>

          <option value="auto">{t("inspector.overflow.auto")}</option>
        </select>
      </label>
      <ContainerLinkedPropertyMeta source={source("layout.overflow").source} onReset={source("layout.overflow").source === "local" && source("layout.overflow").linkedValue !== undefined ? () => onUpdate((container) => ({ ...container, layout: { ...container.layout, overflow: undefined } })) : undefined} />

      <label className={styles.field}>
        <span>{t("inspector.direction")}</span>

        <select
          id="container-direction"
          name="containerDirection"
          value={element.layout?.children?.direction ?? "column"}
          onChange={(event) => {
            const direction = event.target.value as ContainerDirection;

            onUpdate((container) => ({
              ...container, layout: { ...container.layout, children: { ...container.layout?.children, direction } },
            }));
          }}
        >
          <option value="column">{t("inspector.vertical")}</option>

          <option value="row">{t("inspector.horizontal")}</option>
        </select>
      </label>
      <ContainerLinkedPropertyMeta source={source("layout.children.direction").source} onReset={source("layout.children.direction").source === "local" && source("layout.children.direction").linkedValue !== undefined ? () => onUpdate((container) => ({ ...container, layout: { ...container.layout, children: { ...container.layout?.children, direction: undefined } } })) : undefined} />

      <label className={styles.field}>
        <span
          title={
            isStack
              ? t("inspector.distributionDisabledByStack")
              : t("inspector.distributionHelp")
          }
        >
          {t("inspector.distribution")}
        </span>

        <select
          id="container-distribution"
          name="containerDistribution"
          value={element.layout?.children?.distribution ?? "packed"}
          disabled={isStack}
          onChange={(event) => {
            const value = event.target.value as ContainerDistribution;

            onUpdate((container) => ({
              ...container, layout: { ...container.layout, children: { ...container.layout?.children, distribution: value === "packed" && linkedDistribution === undefined ? undefined : value } },
            }));
          }}
        >
          <option value="packed">{t("inspector.distribution.packed")}</option>

          <option value="space-between">
            {t("inspector.distribution.spaceBetween")}
          </option>

          <option value="space-around">
            {t("inspector.distribution.spaceAround")}
          </option>

          <option value="space-evenly">
            {t("inspector.distribution.spaceEvenly")}
          </option>
        </select>
      </label>
      <ContainerLinkedPropertyMeta source={source("layout.children.distribution").source} onReset={source("layout.children.distribution").source === "local" && source("layout.children.distribution").linkedValue !== undefined ? () => onUpdate((container) => ({ ...container, layout: { ...container.layout, children: { ...container.layout?.children, distribution: undefined } } })) : undefined} />

      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span
            title={
              isHorizontalAlignmentDisabled
                ? t("inspector.alignmentDisabledByDistribution")
                : undefined
            }
          >
            {t("inspector.horizontal")}
          </span>

          <select
            id="container-horizontal-align"
            name="containerHorizontalAlign"
            value={element.layout?.children?.horizontalAlign ?? ""}
            disabled={isHorizontalAlignmentDisabled}
            onChange={(event) => {
              const value = event.target.value;

              if (value === "" && linkedHorizontalAlign !== undefined) return;
              const horizontalAlign = value === "" ? undefined : (value as ContainerHorizontalAlign);

              onUpdate((container) => ({
                ...container, layout: { ...container.layout, children: { ...container.layout?.children, horizontalAlign } },
              }));
            }}
          >
            <option value="">{t("inspector.default")}</option>

            <option value="start">{t("inspector.start")}</option>

            <option value="center">{t("inspector.center")}</option>

            <option value="end">{t("inspector.end")}</option>

            <option value="stretch">{t("inspector.stretch")}</option>
          </select>
        </label>
        <ContainerLinkedPropertyMeta source={source("layout.children.horizontalAlign").source} onReset={source("layout.children.horizontalAlign").source === "local" && source("layout.children.horizontalAlign").linkedValue !== undefined ? () => onUpdate((container) => ({ ...container, layout: { ...container.layout, children: { ...container.layout?.children, horizontalAlign: undefined } } })) : undefined} />

        <label className={styles.field}>
          <span
            title={
              isVerticalAlignmentDisabled
                ? t("inspector.alignmentDisabledByDistribution")
                : undefined
            }
          >
            {t("inspector.vertical")}
          </span>

          <select
            id="container-vertical-align"
            name="containerVerticalAlign"
            value={element.layout?.children?.verticalAlign ?? ""}
            disabled={isVerticalAlignmentDisabled}
            onChange={(event) => {
              const value = event.target.value;

              if (value === "" && linkedVerticalAlign !== undefined) return;
              const verticalAlign = value === "" ? undefined : (value as ContainerVerticalAlign);

              onUpdate((container) => ({
                ...container, layout: { ...container.layout, children: { ...container.layout?.children, verticalAlign } },
              }));
            }}
          >
            <option value="">{t("inspector.default")}</option>

            <option value="start">{t("inspector.start")}</option>

            <option value="center">{t("inspector.center")}</option>

            <option value="end">{t("inspector.end")}</option>

            <option value="stretch">{t("inspector.stretch")}</option>
          </select>
        </label>
        <ContainerLinkedPropertyMeta source={source("layout.children.verticalAlign").source} onReset={source("layout.children.verticalAlign").source === "local" && source("layout.children.verticalAlign").linkedValue !== undefined ? () => onUpdate((container) => ({ ...container, layout: { ...container.layout, children: { ...container.layout?.children, verticalAlign: undefined } } })) : undefined} />
      </div>
    </InspectorSection>
  );
}

// ============================================================
// END: CONTAINER LAYOUT SECTION
// ============================================================
