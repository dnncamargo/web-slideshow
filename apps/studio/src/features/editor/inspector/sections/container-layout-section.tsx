import type { ContainerElement } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import {
  type UpdateContainer,
  updateContainerLayoutMode,
} from "../container-inspector-helpers";

import { InspectorSection } from "../inspector-section";

type ContainerDistribution = NonNullable<ContainerElement["distribution"]>;

type ContainerDirection = ContainerElement["direction"];

type ContainerLayoutMode = NonNullable<ContainerElement["layoutMode"]>;

type ContainerHorizontalAlign = NonNullable<
  ContainerElement["horizontalAlign"]
>;

type ContainerVerticalAlign = NonNullable<ContainerElement["verticalAlign"]>;

interface ContainerLayoutSectionProps {
  element: ContainerElement;

  onUpdate: UpdateContainer;
}

// ============================================================
// BEGIN: CONTAINER LAYOUT SECTION
// ============================================================

export function ContainerLayoutSection({
  element,
  onUpdate,
}: ContainerLayoutSectionProps) {
  const { t } = useStudioI18n();

  const hasDistributedMainAxis =
    (element.distribution ?? "packed") !== "packed";
  const isStack = element.layoutMode === "stack";

  const isHorizontalAlignmentDisabled =
    element.direction === "row" && hasDistributedMainAxis;

  const isVerticalAlignmentDisabled =
    element.direction === "column" && hasDistributedMainAxis;

  return (
    <InspectorSection title={t("inspector.layout")} defaultOpen>
      <label className={styles.field}>
        <span title={t("inspector.layoutModeHelp")}>{t("inspector.layoutMode")}</span>

        <select
          id="container-layout-mode"
          name="containerLayoutMode"
          value={element.layoutMode ?? "flow"}
          onChange={(event) => {
            const layoutMode = event.target.value as ContainerLayoutMode;

            onUpdate((container) =>
              updateContainerLayoutMode(container, layoutMode),
            );
          }}
        >
          <option value="flow">{t("inspector.flow")}</option>

          <option value="stack">{t("inspector.stack")}</option>
        </select>
      </label>

      <label className={styles.field}>
        <span>{t("inspector.direction")}</span>

        <select
          id="container-direction"
          name="containerDirection"
          value={element.direction}
          onChange={(event) => {
            const direction = event.target.value as ContainerDirection;

            onUpdate((container) => ({
              ...container,

              direction,
            }));
          }}
        >
          <option value="column">{t("inspector.vertical")}</option>

          <option value="row">{t("inspector.horizontal")}</option>
        </select>
      </label>

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
          value={element.distribution ?? "packed"}
          disabled={isStack}
          onChange={(event) => {
            const value = event.target.value as ContainerDistribution;

            onUpdate((container) => ({
              ...container,

              distribution: value === "packed" ? undefined : value,
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
            value={element.horizontalAlign ?? ""}
            disabled={isHorizontalAlignmentDisabled}
            onChange={(event) => {
              const value = event.target.value;

              const horizontalAlign =
                value === "" ? undefined : (value as ContainerHorizontalAlign);

              onUpdate((container) => ({
                ...container,

                horizontalAlign,
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
            value={element.verticalAlign ?? ""}
            disabled={isVerticalAlignmentDisabled}
            onChange={(event) => {
              const value = event.target.value;

              const verticalAlign =
                value === "" ? undefined : (value as ContainerVerticalAlign);

              onUpdate((container) => ({
                ...container,

                verticalAlign,
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
      </div>
    </InspectorSection>
  );
}

// ============================================================
// END: CONTAINER LAYOUT SECTION
// ============================================================
