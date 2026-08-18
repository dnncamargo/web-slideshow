import { useState } from "react";

import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import { isAbsoluteHttpHref } from "@powershow/document-schema";

import type { ElementLink, PowerShowElement } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import { InspectorSection } from "../inspector-section";

import type { ElementInspectorUpdate } from "../inspector-types";

type LinkableElement = Extract<
  PowerShowElement,
  { type: "text" | "textbox" | "image" }
>;

type OpenInSelection = "same" | "new";

interface ElementInteractionSectionProps {
  element: LinkableElement;

  onUpdate: ElementInspectorUpdate;

  controlPrefix: string;
}

function isLinkableElement(
  element: PowerShowElement,
): element is LinkableElement {
  return (
    element.type === "text" ||
    element.type === "textbox" ||
    element.type === "image"
  );
}

function getOpenInSelection(link: ElementLink | undefined): OpenInSelection {
  return link?.target === "_blank" ? "new" : "same";
}

function createCanonicalLink(
  href: string,
  openIn: OpenInSelection,
): ElementLink {
  return openIn === "new"
    ? { kind: "url", href, target: "_blank" }
    : { kind: "url", href };
}

function elementWithoutLink(element: LinkableElement): LinkableElement {
  const next = { ...element };

  delete next.link;

  return next;
}

// ============================================================
// BEGIN: ELEMENT INTERACTION SECTION
//
// Shared semantic Interaction control used by Text, Textbox and
// Image.
//
// The section never creates a link just by mounting. URL commits
// happen on blur or Enter; invalid drafts are never written to
// the canonical document.
// ============================================================

export function ElementInteractionSection({
  element,
  onUpdate,
  controlPrefix,
}: ElementInteractionSectionProps) {
  const { t } = useStudioI18n();

  const [urlDraft, setUrlDraft] = useState<string>(element.link?.href ?? "");

  const [openIn, setOpenIn] = useState<OpenInSelection>(
    getOpenInSelection(element.link),
  );

  const [invalidUrlMessage, setInvalidUrlMessage] = useState<string | null>(
    null,
  );

  // Hydrate the form whenever the canonical link or the selected
  // element changes. Switching between selected elements must not
  // leak the previous element's URL draft. State is adjusted during
  // render (React's recommended alternative to setState in effects)
  // because the draft must reset when the source link changes.
  const [hydratedFor, setHydratedFor] = useState<{
    id: string;
    href: string | undefined;
    target: ElementLink["target"];
  }>({
    id: element.id,
    href: element.link?.href,
    target: element.link?.target,
  });

  const canonicalHref = element.link?.href;
  const canonicalTarget = element.link?.target;

  if (
    hydratedFor.id !== element.id ||
    hydratedFor.href !== canonicalHref ||
    hydratedFor.target !== canonicalTarget
  ) {
    setHydratedFor({
      id: element.id,
      href: canonicalHref,
      target: canonicalTarget,
    });

    setUrlDraft(canonicalHref ?? "");
    setOpenIn(getOpenInSelection(element.link));
    setInvalidUrlMessage(null);
  }

  function commitUrlDraft(): void {
    const href = urlDraft;

    // Clearing the URL means removing the canonical link.
    if (href.trim() === "") {
      setInvalidUrlMessage(null);
      setUrlDraft("");
      setOpenIn("same");

      if (!element.link) {
        return;
      }

      onUpdate((current) => {
        if (!isLinkableElement(current)) {
          return current;
        }

        return elementWithoutLink(current);
      });

      return;
    }

    if (isAbsoluteHttpHref(href)) {
      setInvalidUrlMessage(null);
      setUrlDraft(href);

      onUpdate((current) => {
        if (!isLinkableElement(current)) {
          return current;
        }

        return {
          ...current,
          link: createCanonicalLink(href, openIn),
        };
      });

      return;
    }

    setInvalidUrlMessage(t("inspector.link.invalidUrl"));
    setUrlDraft(element.link?.href ?? "");
  }

  function handleUrlKeyDown(event: ReactKeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      setUrlDraft(element.link?.href ?? "");
      setInvalidUrlMessage(null);

      return;
    }

    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  }

  function handleOpenInChange(
    event: React.ChangeEvent<HTMLSelectElement>,
  ): void {
    const selection = event.target.value;

    if (selection !== "same" && selection !== "new") {
      return;
    }

    setOpenIn(selection);

    // The target only ever modifies an existing canonical link.
    // Selecting a target alone never creates a link.
    if (!element.link) {
      return;
    }

    onUpdate((current) => {
      if (!isLinkableElement(current)) {
        return current;
      }

      if (!current.link) {
        return current;
      }

      return {
        ...current,

        link: createCanonicalLink(current.link.href, selection),
      };
    });
  }

  function handleRemoveLink(): void {
    onUpdate((current) => {
      if (!isLinkableElement(current)) {
        return current;
      }

      return elementWithoutLink(current);
    });
  }

  return (
    <InspectorSection title={t("inspector.interaction")}>
      <span className={styles.inspectorLabel}>{t("inspector.link")}</span>

      <label className={styles.field}>
        <span>{t("inspector.link.url")}</span>

        <input
          id={`${controlPrefix}-link-url`}
          name={`${controlPrefix}LinkUrl`}
          type="text"
          inputMode="url"
          value={urlDraft}
          placeholder="https://example.com"
          autoComplete="off"
          onChange={(event) => {
            setUrlDraft(event.target.value);
            setInvalidUrlMessage(null);
          }}
          onBlur={commitUrlDraft}
          onKeyDown={handleUrlKeyDown}
        />

        {invalidUrlMessage !== null && (
          <small className={styles.fieldHint}>
            <span>{invalidUrlMessage}</span>
          </small>
        )}
      </label>

      <label className={styles.field}>
        <span>{t("inspector.link.openIn")}</span>

        <select
          id={`${controlPrefix}-link-target`}
          name={`${controlPrefix}LinkTarget`}
          value={openIn}
          onChange={handleOpenInChange}
        >
          <option value="same">{t("inspector.link.sameTab")}</option>

          <option value="new">{t("inspector.link.newTab")}</option>
        </select>
      </label>

      {element.link && (
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleRemoveLink}
        >
          <span>{t("inspector.link.remove")}</span>
        </button>
      )}
    </InspectorSection>
  );
}

// ============================================================
// END: ELEMENT INTERACTION SECTION
// ============================================================
