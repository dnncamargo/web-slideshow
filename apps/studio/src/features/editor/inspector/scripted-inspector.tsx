import { useState } from "react";

import type {
  ScriptedElement,
} from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import { InspectorSection } from "./inspector-section";

import type {
  TypedInspectorProps,
  UpdateSurfaceStyle,
} from "./inspector-types";

import { CanonicalSurfaceAppearanceSection } from "./sections/canonical-surface-appearance-section";
import { CanonicalElementEffectsSection } from "./sections/canonical-element-effects-section";

// ============================================================
// BEGIN: SCRIPTED INSPECTOR
//
// Scripted is authored HTML/CSS/JavaScript executed by the shared
// renderer inside a sandboxed iframe whose only sandbox token is
// allow-scripts. The sandbox policy and the fixed CSP are frozen
// renderer-owned behavior and are NOT authored from Studio, so this
// Inspector deliberately exposes no sandbox/security controls.
//
// Typing must NOT write canonical state on every keystroke: a
// canonical update may rebuild the Scripted iframe and re-run its
// script. All four authored fields therefore live in local drafts
// that commit ONLY through the explicit Apply / Run action, which
// produces exactly one canonical update containing title + html +
// css + script together.
// ============================================================

export function ScriptedInspector({
  element,
  onUpdate,
}: TypedInspectorProps<ScriptedElement>) {
  const { t } = useStudioI18n();

  const [titleDraft, setTitleDraft] = useState<string>(element.title);

  const [htmlDraft, setHtmlDraft] = useState<string>(element.html);

  const [cssDraft, setCssDraft] = useState<string>(element.css);

  const [scriptDraft, setScriptDraft] = useState<string>(element.script);

  const [titleRequiredMessage, setTitleRequiredMessage] = useState<
    string | null
  >(null);

  // Hydrate the form whenever the selected element or its canonical
  // values change. Switching between selected elements must not leak
  // the previous element's drafts. State is adjusted during render
  // (React's recommended alternative to setState in effects) because
  // the drafts must reset when the canonical values change. Hydration
  // performs ZERO canonical writes.
  const [hydratedFor, setHydratedFor] = useState<{
    id: string;
    title: string;
    html: string;
    css: string;
    script: string;
  }>({
    id: element.id,
    title: element.title,
    html: element.html,
    css: element.css,
    script: element.script,
  });

  if (
    hydratedFor.id !== element.id ||
    hydratedFor.title !== element.title ||
    hydratedFor.html !== element.html ||
    hydratedFor.css !== element.css ||
    hydratedFor.script !== element.script
  ) {
    setHydratedFor({
      id: element.id,
      title: element.title,
      html: element.html,
      css: element.css,
      script: element.script,
    });

    setTitleDraft(element.title);
    setHtmlDraft(element.html);
    setCssDraft(element.css);
    setScriptDraft(element.script);
    setTitleRequiredMessage(null);
  }

  // Dirty state is local UI state derived from the drafts. It is
  // never persisted to the canonical document.
  const dirty =
    titleDraft !== element.title ||
    htmlDraft !== element.html ||
    cssDraft !== element.css ||
    scriptDraft !== element.script;

  const updateStyle: UpdateSurfaceStyle = (update) => {
    onUpdate((current) => {
      if (current.type !== "scripted") {
        return current;
      }

      return {
        ...current,

        style: update(current.style),
      };
    });
  };

  function applyDrafts(): void {
    // Canonical title must stay non-empty. The user keeps their draft
    // visible so they can correct it; nothing is written to the
    // document and no default replaces the authored value.
    if (titleDraft.length < 1) {
      setTitleRequiredMessage(t("scripted.titleRequired"));

      return;
    }

    if (!dirty) {
      return;
    }

    setTitleRequiredMessage(null);

    // ONE canonical update containing every authored source field.
    // The "Run" part of the label means: commit canonical state so
    // the shared renderer can recreate the sandboxed iframe. The
    // Inspector never executes authored JavaScript itself.
    onUpdate((current) => {
      if (current.type !== "scripted") {
        return current;
      }

      return {
        ...current,

        title: titleDraft,

        html: htmlDraft,

        css: cssDraft,

        script: scriptDraft,
      };
    });
  }

  function resetDrafts(): void {
    // Reset only local drafts to the canonical values. This performs
    // ZERO canonical writes and ZERO execution.
    setTitleDraft(element.title);
    setHtmlDraft(element.html);
    setCssDraft(element.css);
    setScriptDraft(element.script);
    setTitleRequiredMessage(null);
  }

  return (
    <>
      <div className={styles.inspectorDivider} />

      <InspectorSection title={t("inspector.content")} defaultOpen>
        <label className={styles.field}>
          <span>{t("scripted.title")}</span>

          <input
            id="scripted-title"
            name="scriptedTitle"
            type="text"
            value={titleDraft}
            autoComplete="off"
            onChange={(event) => {
              setTitleDraft(event.target.value);
              setTitleRequiredMessage(null);
            }}
          />

          {titleRequiredMessage !== null && (
            <small className={styles.fieldHint}>
              <span>{titleRequiredMessage}</span>
            </small>
          )}
        </label>

        <label className={styles.field}>
          <span>{t("scripted.html")}</span>

          <textarea
            id="scripted-html"
            name="scriptedHtml"
            className={`${styles.textArea} ${styles.codeTextArea}`}
            rows={6}
            spellCheck={false}
            value={htmlDraft}
            onChange={(event) => {
              setHtmlDraft(event.target.value);
            }}
          />
        </label>

        <label className={styles.field}>
          <span>{t("scripted.css")}</span>

          <textarea
            id="scripted-css"
            name="scriptedCss"
            className={`${styles.textArea} ${styles.codeTextArea}`}
            rows={6}
            spellCheck={false}
            value={cssDraft}
            onChange={(event) => {
              setCssDraft(event.target.value);
            }}
          />
        </label>

        <label className={styles.field}>
          <span>{t("scripted.javascript")}</span>

          <textarea
            id="scripted-script"
            name="scriptedScript"
            className={`${styles.textArea} ${styles.codeTextArea}`}
            rows={8}
            spellCheck={false}
            value={scriptDraft}
            onChange={(event) => {
              setScriptDraft(event.target.value);
            }}
          />
        </label>

        <div className={styles.elementCrudActions}>
          <button
            id="scripted-apply-run"
            type="button"

            className={`${styles.secondaryButton} ${styles.elementCrudPrimary}`}

            disabled={!dirty}

            onClick={applyDrafts}
          >
            <span>{t("scripted.applyRun")}</span>
          </button>

          <button
            id="scripted-reset"
            type="button"

            className={styles.secondaryButton}

            disabled={!dirty}

            onClick={resetDrafts}
          >
            <span>{t("scripted.reset")}</span>
          </button>
        </div>

        <small className={styles.fieldHint}>
          <span>{t("scripted.applyHelp")}</span>
        </small>

        <small className={styles.fieldHint}>
          <span>{t("scripted.sandboxHelp")}</span>
        </small>
      </InspectorSection>

      <CanonicalSurfaceAppearanceSection
        style={element.style}
        onUpdateStyle={updateStyle}
        controlPrefix="scripted"
      />

      <CanonicalElementEffectsSection
        effect={element.effect}
        onUpdateEffect={(update) => onUpdate((current) => current.type === "scripted" ? { ...current, effect: update(current.effect) } : current)}
        controlPrefix="scripted"
      />
    </>
  );
}

// ============================================================
// END: SCRIPTED INSPECTOR
// ============================================================
