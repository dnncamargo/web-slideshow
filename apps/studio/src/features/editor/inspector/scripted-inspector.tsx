import { useState } from "react";

import type {
  PresentationFileResource,
  ScriptedElement,
  ScriptedPort,
} from "@web-slideshow/document-schema";
import { ScriptedElementSchema } from "@web-slideshow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";
import resourceStyles from "../resources/custom-resources-workspace.module.css";

import { InspectorSection } from "./inspector-section";

import { useAuthoringHistory } from "../authoring-history-context";

import type {
  ScriptedSourceEditRequest,
  ScriptedSourceKind,
  TypedInspectorProps,
  UpdateSurfaceStyle,
} from "./inspector-types";

import { CanonicalSurfaceAppearanceSection } from "./sections/canonical-surface-appearance-section";
import { CanonicalElementEffectsSection } from "./sections/canonical-element-effects-section";
import { ElementSpacingSection } from "./sections/element-spacing-section";

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

type ScriptedAggregate = Pick<
  ScriptedElement,
  "title" | "html" | "css" | "script" | "ports" | "resourceIds"
>;

function scriptedAggregate(element: ScriptedElement): ScriptedAggregate {
  return {
    title: element.title,
    html: element.html,
    css: element.css,
    script: element.script,
    ports: element.ports,
    resourceIds: element.resourceIds,
  };
}

function scriptedAggregatesEqual(
  left: ScriptedAggregate,
  right: ScriptedAggregate,
): boolean {
  return left.title === right.title
    && left.html === right.html
    && left.css === right.css
    && left.script === right.script
    && portsDraftIdentity(left.ports) === portsDraftIdentity(right.ports)
    && JSON.stringify(left.resourceIds) === JSON.stringify(right.resourceIds);
}

function resourceUsageExample(resource: PresentationFileResource): string {
  const resourceIdLiteral = JSON.stringify(resource.id);
  const address = `ScriptedRuntime.resources.get(${resourceIdLiteral})`;
  if (resource.representation === "text" && resource.contentType === "application/json") {
    return `const resource = ${address};\nconst data = JSON.parse(resource.content);`;
  }
  if (resource.representation === "text") {
    return `const resource = ${address};\nconst content = resource.content;`;
  }
  if (resource.kind === "image") {
    return `const resource = ${address};\ndocument.querySelector("img").src = resource.url;`;
  }
  if (resource.kind === "audio") {
    return `const resource = ${address};\ndocument.querySelector("audio").src = resource.url;`;
  }
  return `const resource = ${address};\nconst url = resource.url;`;
}

function ScriptedResourceRow({
  resource,
  onRemove,
}: {
  resource: PresentationFileResource;
  onRemove: () => void;
}) {
  const { t } = useStudioI18n();
  const resourceIdLiteral = JSON.stringify(resource.id);
  const address = `ScriptedRuntime.resources.get(${resourceIdLiteral})`;

  return (
    <div className={resourceStyles.resourceItem} data-presentation-scripted-resource-row>
      <div className={resourceStyles.resourceItemDetailsStack}>
        <strong>{resource.name}</strong>
        <span className={resourceStyles.masterPaletteCount}>{resource.kind} · {resource.contentType}</span>
        <code>{address}</code>
        <pre className={styles.fieldHint}>{resourceUsageExample(resource)}</pre>
      </div>
      <button
        type="button"
        className={resourceStyles.resourceIconAction}
        data-presentation-scripted-resource-remove="true"
        aria-label={t("scripted.removeResource", { name: resource.name })}
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
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

function sourcePreview(source: string): string {
  const compact = source.replace(/\s+/g, " ").trim();
  if (compact.length === 0) return "—";
  return compact.length > 72 ? `${compact.slice(0, 69)}…` : compact;
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
// script. Content, Ports, and Resources therefore live in local
// drafts that commit together ONLY through the explicit Apply / Run
// action, which produces exactly one canonical update.
// ============================================================

export function ScriptedInspector({
  element,
  onUpdate,
  presentationFiles = [],
  onEditSource,
  activeSource = null,
  largeSourceEditorActive = false,
  largeSourceEditorDirty = false,
}: TypedInspectorProps<ScriptedElement> & {
  presentationFiles?: readonly PresentationFileResource[];
  onEditSource?: (request: ScriptedSourceEditRequest) => void;
  activeSource?: ScriptedSourceKind | null;
  largeSourceEditorActive?: boolean;
  largeSourceEditorDirty?: boolean;
}) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();

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

  const [resourceIdsDraft, setResourceIdsDraft] = useState<string[]>(element.resourceIds);

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
    resourceIds: string;
  }>({
    id: element.id,
    title: element.title,
    html: element.html,
    css: element.css,
    script: element.script,
    ports: portsDraftIdentity(element.ports),
    resourceIds: JSON.stringify(element.resourceIds),
  });

  if (
    hydratedFor.id !== element.id ||
    hydratedFor.title !== element.title ||
    hydratedFor.html !== element.html ||
    hydratedFor.css !== element.css ||
    hydratedFor.script !== element.script
    || hydratedFor.ports !== portsDraftIdentity(element.ports)
    || hydratedFor.resourceIds !== JSON.stringify(element.resourceIds)
  ) {
    setHydratedFor({
      id: element.id,
      title: element.title,
      html: element.html,
      css: element.css,
      script: element.script,
      ports: portsDraftIdentity(element.ports),
      resourceIds: JSON.stringify(element.resourceIds),
    });

    setTitleDraft(element.title);
    setHtmlDraft(element.html);
    setCssDraft(element.css);
    setScriptDraft(element.script);
    setPortsDraft(portDrafts(element.ports));
    setResourceIdsDraft(element.resourceIds);
    setSelectedPortIndex(element.ports.length > 0 ? 0 : null);
    setTitleRequiredMessage(null);
    setPortsMessage(null);
  }

  // Dirty state is local UI state derived from the drafts. It is
  // never persisted to the canonical document.
  const resourcesDirty = JSON.stringify(resourceIdsDraft) !== JSON.stringify(element.resourceIds);
  const dirty =
    titleDraft !== element.title ||
    htmlDraft !== element.html ||
    cssDraft !== element.css ||
    scriptDraft !== element.script ||
    JSON.stringify(portsDraft) !== JSON.stringify(portDrafts(element.ports)) ||
    resourcesDirty;

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
    if (largeSourceEditorDirty) return;

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
      resourceIds: resourceIdsDraft,
    });
    if (!parsed.success) {
      setPortsMessage(t("scripted.invalidPort"));
      return;
    }

    const candidate: ScriptedAggregate = {
      title: titleDraft,
      html: htmlDraft,
      css: cssDraft,
      script: scriptDraft,
      ports: parsed.data.ports,
      resourceIds: parsed.data.resourceIds,
    };

    if (!dirty || scriptedAggregatesEqual(candidate, scriptedAggregate(element))) {
      return;
    }

    setTitleRequiredMessage(null);

    // ONE canonical update containing every authored source field.
    // The "Run" part of the label means: commit canonical state so
    // the shared renderer can recreate the sandboxed iframe. The
    // Inspector never executes authored JavaScript itself.
    const apply = () => onUpdate((current) => {
      if (current.type !== "scripted") {
        return current;
      }

      const currentParsed = ScriptedElementSchema.safeParse({
        ...current,
        ...candidate,
      });
      if (!currentParsed.success) {
        return current;
      }

      const currentAggregate = scriptedAggregate(current);
      if (scriptedAggregatesEqual(candidate, currentAggregate)) {
        return current;
      }

      return {
        ...current,
        title: candidate.title,
        html: candidate.html,
        css: candidate.css,
        script: candidate.script,
        ports: currentParsed.data.ports,
        resourceIds: currentParsed.data.resourceIds,
      };
    });

    if (authoringHistory) {
      authoringHistory.discrete(
        {
          kind: "element.setting",
          labelKey: "history.element.setting",
          labelParams: { setting: "scripted.applyRun" },
        },
        apply,
      );
    } else {
      apply();
    }
  }

  function resetDrafts(): void {
    if (largeSourceEditorActive) return;

    // Reset only local drafts to the canonical values. This performs
    // ZERO canonical writes and ZERO execution.
    setTitleDraft(element.title);
    setHtmlDraft(element.html);
    setCssDraft(element.css);
    setScriptDraft(element.script);
    setPortsDraft(portDrafts(element.ports));
    setResourceIdsDraft(element.resourceIds);
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

  function addResource(resourceId: string): void {
    setResourceIdsDraft((current) => current.includes(resourceId) ? current : [...current, resourceId]);
  }

  function removeResource(resourceId: string): void {
    setResourceIdsDraft((current) => current.filter((id) => id !== resourceId));
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

  function editSource(source: ScriptedSourceKind, baseline: string): void {
    onEditSource?.({
      elementId: element.id,
      source,
      baseline,
      onSaveDraft: source === "html"
        ? setHtmlDraft
        : source === "css"
          ? setCssDraft
          : setScriptDraft,
    });
  }

  const sourceRows: readonly { kind: ScriptedSourceKind; label: string; value: string }[] = [
    { kind: "html", label: t("scripted.html"), value: htmlDraft },
    { kind: "css", label: t("scripted.css"), value: cssDraft },
    { kind: "script", label: t("scripted.javascript"), value: scriptDraft },
  ];

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

        <div className={styles.scriptedSourceList}>
          {sourceRows.map((row) => {
            const editDisabled = largeSourceEditorActive && (
              largeSourceEditorDirty || activeSource === row.kind
            );
            return (
              <div key={row.kind} className={styles.scriptedSourceRow} data-scripted-source={row.kind}>
                <div className={styles.scriptedSourceDetails}>
                  <span className={styles.fieldLabel}>{row.label}</span>
                  <code className={styles.scriptedSourcePreview} title={row.value}>{sourcePreview(row.value)}</code>
                </div>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  data-scripted-source-edit={row.kind}
                  disabled={editDisabled}
                  onClick={() => editSource(row.kind, row.value)}
                >
                  {t("scripted.editSource")}
                </button>
              </div>
            );
          })}
        </div>

        <small className={styles.fieldHint}>
          <span>{t("scripted.sandboxHelp")}</span>
        </small>
      </InspectorSection>

      <InspectorSection title={t("scripted.ports")} defaultOpen>
        <small className={styles.fieldHint}><span>{t("scripted.portsHelp")}</span></small>
        <div className={styles.galleryItemSelector}>{portsDraft.map((port, index) => <div key={index} className={styles.galleryItemSelectorRow}><button type="button" className={`${styles.secondaryButton} ${styles.galleryItemSelectorButton} ${index === selectedPortIndex ? styles.galleryItemSelectorButtonSelected : ""}`} data-presentation-scripted-port-select="true" data-presentation-scripted-port-index={index} aria-pressed={index === selectedPortIndex} onClick={() => setSelectedPortIndex(index)}><span className={styles.galleryItemName}>{port.label || t("scripted.port")}</span></button></div>)}</div>
        <div className={styles.galleryItemActions}><button type="button" className="ps-ui-action" data-presentation-scripted-port-add="true" onClick={addPort}>+ {t("scripted.addPort")}</button>{selectedPort && <button type="button" className="ps-ui-action" data-presentation-scripted-port-remove="true" aria-label={t("inspector.remove")} onClick={removeSelectedPort}><span>{t("inspector.remove")}</span></button>}</div>
        {selectedPort && <>
          <label className={styles.field}><span>{t("scripted.portLabel")}</span><input data-presentation-scripted-port-label="true" value={selectedPort.label} onChange={(event) => updateSelectedPort((port) => ({ ...port, label: event.target.value }))} /></label>
          <label className={styles.field}><span>{t("scripted.portId")}</span><input data-presentation-scripted-port-id="true" value={selectedPort.id} onChange={(event) => updateSelectedPort((port) => ({ ...port, id: event.target.value }))} /></label>
          <label className={styles.field}><span>{t("scripted.portType")}</span><select data-presentation-scripted-port-type="true" value={selectedPort.kind} onChange={(event) => changeSelectedPortKind(event.target.value as ScriptedPortDraft["kind"])}><option value="action">{t("scripted.action")}</option><option value="boolean">{t("scripted.boolean")}</option><option value="number">{t("scripted.number")}</option></select></label>
          {selectedPort.kind !== "action" && <label className={styles.field}><span>{t("scripted.direction")}</span><select data-presentation-scripted-port-direction="true" value={selectedPort.direction} onChange={(event) => updateSelectedPort((port) => port.kind === "action" ? port : { ...port, direction: event.target.value as "input" | "output" | "input-output" })}><option value="input">{t("scripted.input")}</option><option value="output">{t("scripted.output")}</option><option value="input-output">{t("scripted.inputOutput")}</option></select></label>}
          {selectedPort.kind === "number" && <><label className={styles.field}><span>{t("scripted.min")}</span><input type="text" inputMode="decimal" data-presentation-scripted-port-min="true" value={selectedPort.min} onChange={(event) => updateSelectedPort((port) => port.kind === "number" ? { ...port, min: event.target.value } : port)} /></label><label className={styles.field}><span>{t("scripted.max")}</span><input type="text" inputMode="decimal" data-presentation-scripted-port-max="true" value={selectedPort.max} onChange={(event) => updateSelectedPort((port) => port.kind === "number" ? { ...port, max: event.target.value } : port)} /></label><label className={styles.field}><span>{t("scripted.step")}</span><input type="text" inputMode="decimal" data-presentation-scripted-port-step="true" value={selectedPort.step} onChange={(event) => updateSelectedPort((port) => port.kind === "number" ? { ...port, step: event.target.value } : port)} /></label></>}
        </>}
        {portsMessage && <small className={styles.fieldHint}><span>{portsMessage}</span></small>}

      </InspectorSection>

      <InspectorSection title={t("scripted.resources")} defaultOpen>
        <small className={styles.fieldHint}><span>{t("scripted.resourcesHelp")}</span></small>
        {presentationFiles.length === 0 ? (
          <p className={styles.status}>{t("scripted.noResources")}</p>
        ) : (
          <>
            <span className={resourceStyles.masterPaletteCount}>{t("scripted.resourceSelected")}</span>
            <div className={resourceStyles.localFontList} data-presentation-scripted-resources>
              {resourceIdsDraft.map((resourceId) => {
                const resource = presentationFiles.find((file) => file.id === resourceId);
                return resource ? <ScriptedResourceRow key={resource.id} resource={resource} onRemove={() => removeResource(resource.id)} /> : null;
              })}
            </div>
            <span className={resourceStyles.masterPaletteCount}>{t("scripted.resourceAvailable")}</span>
            <div className={resourceStyles.localFontList} data-presentation-scripted-resource-available>
              {presentationFiles.filter((file) => !resourceIdsDraft.includes(file.id)).map((resource) => (
                <div key={resource.id} className={resourceStyles.resourceItem} data-presentation-scripted-resource-available-row>
                  <div className={resourceStyles.resourceItemDetailsStack}>
                    <strong>{resource.name}</strong>
                    <span className={resourceStyles.masterPaletteCount}>{resource.kind} · {resource.contentType}</span>
                  </div>
                  <button type="button" className={resourceStyles.resourceAction} data-presentation-scripted-resource-add="true" aria-label={t("scripted.addResource", { name: resource.name })} onClick={() => addResource(resource.id)}>+</button>
                </div>
              ))}
            </div>
          </>
        )}
      </InspectorSection>

      <div className={styles.elementCrudActions}>
          <button
            id="scripted-apply-run"
            type="button"

            className={styles.secondaryButton}

            disabled={!dirty || largeSourceEditorDirty}

            onClick={applyDrafts}
          >
            <span>{t("scripted.applyRun")}</span>
          </button>

          <button
            id="scripted-reset"
            type="button"

            className={styles.secondaryButton}

            disabled={!dirty || largeSourceEditorActive}

            onClick={resetDrafts}
          >
            <span>{t("scripted.reset")}</span>
          </button>
      </div>

        <small className={styles.fieldHint}>
          <span>{t("scripted.applyHelp")}</span>
        </small>


      <ElementSpacingSection
        layout={element.layout}
        controlPrefix="scripted"
        onUpdateLayout={(update) => onUpdate((current) => current.type === "scripted"
          ? { ...current, layout: update(current.layout) }
          : current)}
      />

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
