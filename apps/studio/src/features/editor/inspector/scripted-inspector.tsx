import { useState } from "react";

import type {
  ScriptedElement,
  ScriptedPort,
} from "@powershow/document-schema";
import { ScriptedElementSchema } from "@powershow/document-schema";

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

type ScriptedPortDraft =
  | { id: string; label: string; kind: "action" }
  | { id: string; label: string; kind: "boolean" | "number"; direction: "input" | "output" | "input-output"; min: string; max: string; step: string };

function portDrafts(ports: ScriptedPort[]): ScriptedPortDraft[] {
  return ports.map((port) => port.kind === "action"
    ? { id: port.id, label: port.label, kind: "action" }
    : {
      id: port.id,
      label: port.label,
      kind: port.kind,
      direction: port.direction,
      min: port.kind === "number" && port.min !== undefined ? String(port.min) : "",
      max: port.kind === "number" && port.max !== undefined ? String(port.max) : "",
      step: port.kind === "number" && port.step !== undefined ? String(port.step) : "",
    });
}

function portsDraftIdentity(ports: ScriptedPort[]): string {
  return JSON.stringify(ports);
}

function portDraftToCanonical(port: ScriptedPortDraft): unknown {
  if (port.kind === "action") return port;

  if (port.kind === "boolean") {
    return { id: port.id, label: port.label, kind: port.kind, direction: port.direction };
  }

  function optionalNumber(value: string): number | undefined | null {
    if (value === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const min = optionalNumber(port.min);
  const max = optionalNumber(port.max);
  const step = optionalNumber(port.step);
  if (min === null || max === null || step === null) return null;
  return { id: port.id, label: port.label, kind: "number", direction: port.direction, ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }), ...(step === undefined ? {} : { step }) };
}

function nextPortId(ports: ScriptedPortDraft[]): string {
  const ids = new Set(ports.map((port) => port.id));
  if (!ids.has("port")) return "port";
  let suffix = 2;
  while (ids.has(`port-${suffix}`)) suffix += 1;
  return `port-${suffix}`;
}
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

  const [portsDraft, setPortsDraft] = useState<ScriptedPortDraft[]>(
    portDrafts(element.ports),
  );
  const [selectedPortIndex, setSelectedPortIndex] = useState<number | null>(
    element.ports.length > 0 ? 0 : null,
  );
  const [portsMessage, setPortsMessage] = useState<string | null>(null);

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
    ports: string;
  }>({
    id: element.id,
    title: element.title,
    html: element.html,
    css: element.css,
    script: element.script,
    ports: portsDraftIdentity(element.ports),
  });

  if (
    hydratedFor.id !== element.id ||
    hydratedFor.title !== element.title ||
    hydratedFor.html !== element.html ||
    hydratedFor.css !== element.css ||
    hydratedFor.script !== element.script
    || hydratedFor.ports !== portsDraftIdentity(element.ports)
  ) {
    setHydratedFor({
      id: element.id,
      title: element.title,
      html: element.html,
      css: element.css,
      script: element.script,
      ports: portsDraftIdentity(element.ports),
    });

    setTitleDraft(element.title);
    setHtmlDraft(element.html);
    setCssDraft(element.css);
    setScriptDraft(element.script);
    setPortsDraft(portDrafts(element.ports));
    setSelectedPortIndex(element.ports.length > 0 ? 0 : null);
    setTitleRequiredMessage(null);
    setPortsMessage(null);
  }

  // Dirty state is local UI state derived from the drafts. It is
  // never persisted to the canonical document.
  const dirty =
    titleDraft !== element.title ||
    htmlDraft !== element.html ||
    cssDraft !== element.css ||
    scriptDraft !== element.script ||
    JSON.stringify(portsDraft) !== JSON.stringify(portDrafts(element.ports));

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

    const candidatePorts = portsDraft.map(portDraftToCanonical);
    if (candidatePorts.some((port) => port === null)) {
      setPortsMessage(t("scripted.invalidPort"));
      return;
    }
    const parsed = ScriptedElementSchema.safeParse({
      ...element,
      title: titleDraft,
      html: htmlDraft,
      css: cssDraft,
      script: scriptDraft,
      ports: candidatePorts,
    });
    if (!parsed.success) {
      setPortsMessage(t("scripted.invalidPort"));
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

        ports: parsed.data.ports,
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
    setPortsDraft(portDrafts(element.ports));
    setSelectedPortIndex(element.ports.length > 0 ? 0 : null);
    setTitleRequiredMessage(null);
    setPortsMessage(null);
  }

  const selectedPort = selectedPortIndex === null ? null : portsDraft[selectedPortIndex] ?? null;
  function updateSelectedPort(update: (port: ScriptedPortDraft) => ScriptedPortDraft): void {
    if (selectedPortIndex === null) return;
    setPortsDraft((current) => current.map((port, index) => index === selectedPortIndex ? update(port) : port));
    setPortsMessage(null);
  }

  function addPort(): void {
    setPortsDraft((current) => [...current, { id: nextPortId(current), label: "Port", kind: "action" }]);
    setSelectedPortIndex(portsDraft.length);
    setPortsMessage(null);
  }

  function removeSelectedPort(): void {
    if (selectedPortIndex === null) return;
    setPortsDraft((current) => current.filter((_port, index) => index !== selectedPortIndex));
    const nextLength = portsDraft.length - 1;
    setSelectedPortIndex(nextLength === 0 ? null : Math.min(selectedPortIndex, nextLength - 1));
    setPortsMessage(null);
  }

  function changeSelectedPortKind(kind: ScriptedPortDraft["kind"]): void {
    updateSelectedPort((port) => {
      if (kind === "action") return { id: port.id, label: port.label, kind };
      const direction = port.kind === "action" ? "input" : port.direction;
      return { id: port.id, label: port.label, kind, direction, min: "", max: "", step: "" };
    });
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

        <div className={styles.inspectorDivider} />
        <span>{t("scripted.ports")}</span>
        <small className={styles.fieldHint}><span>{t("scripted.portsHelp")}</span></small>
        <div className={styles.galleryItemSelector}>{portsDraft.map((port, index) => <div key={index} className={styles.galleryItemSelectorRow}><button type="button" className={`${styles.secondaryButton} ${styles.galleryItemSelectorButton} ${index === selectedPortIndex ? styles.galleryItemSelectorButtonSelected : ""}`} data-powershow-scripted-port-select="true" data-powershow-scripted-port-index={index} aria-pressed={index === selectedPortIndex} onClick={() => setSelectedPortIndex(index)}><span className={styles.galleryItemName}>{port.label || t("scripted.port")}</span></button></div>)}</div>
        <div className={styles.elementCrudActions}><button type="button" className={`${styles.secondaryButton} ${styles.elementCrudPrimary}`} data-powershow-scripted-port-add="true" onClick={addPort}>{t("scripted.addPort")}</button>{selectedPort && <button type="button" className={styles.secondaryButton} data-powershow-scripted-port-remove="true" aria-label={t("scripted.removePort")} onClick={removeSelectedPort}>×</button>}</div>
        {selectedPort && <>
          <label className={styles.field}><span>{t("scripted.portLabel")}</span><input data-powershow-scripted-port-label="true" value={selectedPort.label} onChange={(event) => updateSelectedPort((port) => ({ ...port, label: event.target.value }))} /></label>
          <label className={styles.field}><span>{t("scripted.portId")}</span><input data-powershow-scripted-port-id="true" value={selectedPort.id} onChange={(event) => updateSelectedPort((port) => ({ ...port, id: event.target.value }))} /></label>
          <label className={styles.field}><span>{t("scripted.portType")}</span><select data-powershow-scripted-port-type="true" value={selectedPort.kind} onChange={(event) => changeSelectedPortKind(event.target.value as ScriptedPortDraft["kind"])}><option value="action">{t("scripted.action")}</option><option value="boolean">{t("scripted.boolean")}</option><option value="number">{t("scripted.number")}</option></select></label>
          {selectedPort.kind !== "action" && <label className={styles.field}><span>{t("scripted.direction")}</span><select data-powershow-scripted-port-direction="true" value={selectedPort.direction} onChange={(event) => updateSelectedPort((port) => port.kind === "action" ? port : { ...port, direction: event.target.value as "input" | "output" | "input-output" })}><option value="input">{t("scripted.input")}</option><option value="output">{t("scripted.output")}</option><option value="input-output">{t("scripted.inputOutput")}</option></select></label>}
          {selectedPort.kind === "number" && <><label className={styles.field}><span>{t("scripted.min")}</span><input type="text" inputMode="decimal" data-powershow-scripted-port-min="true" value={selectedPort.min} onChange={(event) => updateSelectedPort((port) => port.kind === "number" ? { ...port, min: event.target.value } : port)} /></label><label className={styles.field}><span>{t("scripted.max")}</span><input type="text" inputMode="decimal" data-powershow-scripted-port-max="true" value={selectedPort.max} onChange={(event) => updateSelectedPort((port) => port.kind === "number" ? { ...port, max: event.target.value } : port)} /></label><label className={styles.field}><span>{t("scripted.step")}</span><input type="text" inputMode="decimal" data-powershow-scripted-port-step="true" value={selectedPort.step} onChange={(event) => updateSelectedPort((port) => port.kind === "number" ? { ...port, step: event.target.value } : port)} /></label></>}
        </>}
        {portsMessage && <small className={styles.fieldHint}><span>{portsMessage}</span></small>}

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
        element={element}
        style={element.style}
        effect={element.effect}
        onUpdateStyle={updateStyle}
        onUpdateEffect={(update) => onUpdate((current) => current.type === "scripted" ? { ...current, effect: update(current.effect) } : current)}
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
