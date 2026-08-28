"use client";

import { getFontResourceFaces, FUNDAMENTAL_TYPOGRAPHY_STYLE_IDS, type Color, type FontResource, type PresentationPaletteColor, type TextElement, type TypographyStyle, type TypographyStyleProperties, type TypographyStyleRole } from "@powershow/document-schema";
import { renderElement } from "@powershow/renderer";
import { TEXT_VARIANT_TYPOGRAPHY_DEFAULTS } from "@powershow/theme/element-style-defaults";
import { useCallback, useEffect, useRef, useState } from "react";

import { LiteralColorInput } from "@/features/editor/color/literal-color-input";
import { InspectorSection } from "@/features/editor/inspector/inspector-section";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import type { CustomLibraryPaletteDraft } from "@/features/custom-library/custom-library-palette";
import type {
  CustomLibraryPaletteRecord,
  CustomLibraryPaletteRepository,
} from "@/features/custom-library/custom-library-palette-repository";
import type { CustomLibraryPaletteAddOutcome } from "@/features/custom-library/custom-library-palette-add-picker";
import type { CustomLibraryFontDraft, CustomLibraryFontRecord } from "@/features/custom-library/custom-library-font";
import type { CustomLibraryFontRepository } from "@/features/custom-library/custom-library-font-repository";
import { getDefaultCustomLibraryPaletteRepository } from "@/features/persistence/custom-library-palette-repository-instance";
import { getDefaultCustomLibraryFontRepository } from "@/features/persistence/custom-library-font-repository-instance";
import { ElementTypographyFields } from "../inspector/sections/element-typography-control";
import { listPresentationTypographyStyles, normalizeTypographyStyleProperties } from "../typography-style-helpers";

import styles from "./custom-resources-workspace.module.css";

interface CustomResourcesWorkspaceProps {
  customLibraryPaletteRepository?: CustomLibraryPaletteRepository;
  customLibraryFontRepository?: CustomLibraryFontRepository;
  presentationColors: readonly PresentationPaletteColor[];
  presentationFonts: readonly FontResource[];
  onAddLibraryPalette: (palette: CustomLibraryPaletteDraft) => CustomLibraryPaletteAddOutcome;
  onAddLibraryFont: (font: CustomLibraryFontDraft) => CustomLibraryFontAddOutcome;
  onAddPresentationColor: (name: string, value: Color) => void;
  onUpdatePresentationColor: (id: string, patch: { name: string; value: Color }) => void;
  onRemovePresentationColor: (id: string) => void;
  onRemovePresentationFont: (id: string) => CustomLibraryFontRemoveOutcome;
  isPresentationFontInUse: (family: string) => boolean;
  presentationTypographyStyles?: readonly TypographyStyle[];
  onUpdateFundamentalTypographyStyle?: (id: "title" | "subtitle" | "body" | "caption", typography: TypographyStyleProperties) => void;
  onResetFundamentalTypographyStyle?: (id: "title" | "subtitle" | "body" | "caption") => void;
  onAddTypographyStyle?: (name: string, role: TypographyStyleRole) => void;
  onUpdateTypographyStyle?: (id: string, patch: { name?: string; role?: TypographyStyleRole; typography?: TypographyStyleProperties }) => void;
  onRemoveTypographyStyle?: (id: string) => void;
  isTypographyStyleInUse?: (id: string) => boolean;
}

export type CustomLibraryFontAddKind = "added" | "merged" | "unchanged" | "conflict";
export interface CustomLibraryFontAddOutcome {
  kind: CustomLibraryFontAddKind;
  addedFaces: number;
}
export type CustomLibraryFontRemoveOutcome = "removed" | "in-use" | "not-found";

type PaletteLoadState =
  | { kind: "loading" }
  | { kind: "ready"; records: CustomLibraryPaletteRecord[] }
  | { kind: "error" };

type FontLoadState =
  | { kind: "loading" }
  | { kind: "ready"; records: CustomLibraryFontRecord[] }
  | { kind: "error" };

const PREVIEW_COLOR_LIMIT = 6;

export function CustomResourcesWorkspace({
  customLibraryPaletteRepository = getDefaultCustomLibraryPaletteRepository(),
  customLibraryFontRepository = getDefaultCustomLibraryFontRepository(),
  presentationColors,
  presentationFonts,
  onAddLibraryPalette,
  onAddLibraryFont,
  onAddPresentationColor,
  onUpdatePresentationColor,
  onRemovePresentationColor,
  onRemovePresentationFont,
  isPresentationFontInUse,
  presentationTypographyStyles = [],
  onUpdateFundamentalTypographyStyle = () => undefined,
  onResetFundamentalTypographyStyle = () => undefined,
  onAddTypographyStyle = () => undefined,
  onUpdateTypographyStyle = () => undefined,
  onRemoveTypographyStyle = () => undefined,
  isTypographyStyleInUse = () => false,
}: CustomResourcesWorkspaceProps) {
  const { t } = useStudioI18n();
  const [loadState, setLoadState] = useState<PaletteLoadState>({ kind: "loading" });
  const [fontLoadState, setFontLoadState] = useState<FontLoadState>({ kind: "loading" });
  const [chooserOpen, setChooserOpen] = useState(false);
  const [localColorAddOpen, setLocalColorAddOpen] = useState(false);
  const [colorName, setColorName] = useState("");
  const [colorValue, setColorValue] = useState<Color>("#ffffff");
  const requestRevisionRef = useRef(0);
  const fontRequestRevisionRef = useRef(0);
  const [fontChooserOpen, setFontChooserOpen] = useState(false);
  const [fontFeedback, setFontFeedback] = useState<{ kind: CustomLibraryFontAddKind; family: string; count: number } | null>(null);
  const [editingStyleId, setEditingStyleId] = useState<string | null>(null);
  const [addingStyle, setAddingStyle] = useState(false);

  const loadPalettes = useCallback(() => {
    const requestRevision = requestRevisionRef.current + 1;
    requestRevisionRef.current = requestRevision;
    setLoadState({ kind: "loading" });
    void Promise.resolve()
      .then(() => customLibraryPaletteRepository.listPalettes())
      .then((records) => {
        if (requestRevision === requestRevisionRef.current) setLoadState({ kind: "ready", records });
      })
      .catch(() => {
        if (requestRevision === requestRevisionRef.current) setLoadState({ kind: "error" });
      });
  }, [customLibraryPaletteRepository]);

  const loadFonts = useCallback(() => {
    const requestRevision = fontRequestRevisionRef.current + 1;
    fontRequestRevisionRef.current = requestRevision;
    setFontLoadState({ kind: "loading" });
    void Promise.resolve()
      .then(() => customLibraryFontRepository.listFonts())
      .then((records) => {
        if (requestRevision === fontRequestRevisionRef.current) setFontLoadState({ kind: "ready", records });
      })
      .catch(() => {
        if (requestRevision === fontRequestRevisionRef.current) setFontLoadState({ kind: "error" });
      });
  }, [customLibraryFontRepository]);

  useEffect(() => {
    void Promise.resolve().then(loadPalettes);
    void Promise.resolve().then(loadFonts);
    return () => {
      requestRevisionRef.current += 1;
      fontRequestRevisionRef.current += 1;
    };
  }, [loadFonts, loadPalettes]);

  function addLibraryFont(font: CustomLibraryFontDraft): void {
    const result = onAddLibraryFont(font);
    setFontFeedback({ kind: result.kind, family: font.family, count: result.addedFaces });
  }

  function addIndividualColor(): void {
    const name = colorName.trim();
    if (!name) return;
    onAddPresentationColor(name, colorValue);
    setColorName("");
  }

  return (
    <aside className={styles.workspace} aria-label={t("editor.customResources")}>
      <div className={styles.header}><span>{t("customResources.title")}</span></div>

      <div className={styles.content}>
        <section className={styles.scope} aria-labelledby="custom-resources-from-library">
          <h2 id="custom-resources-from-library" className={styles.sectionTitle}>{t("customResources.fromLibrary")}</h2>
          <InspectorSection title={t("customResources.palettes")} defaultOpen>
            <div className={styles.group}>
              <div className={styles.groupHeader}>
                <button type="button" className={styles.resourceAction} onClick={() => setChooserOpen((open) => !open)}>
                  {chooserOpen ? t("customResources.closePaletteChooser") : t("customResources.addPalette")}
                </button>
              </div>
              {chooserOpen ? <MasterPaletteChooser loadState={loadState} onRetry={loadPalettes} onAdd={onAddLibraryPalette} /> : null}
            </div>
          </InspectorSection>
          <InspectorSection title={t("customResources.fonts")} defaultOpen>
            <div className={styles.group}>
              <div className={styles.groupHeader}>
                <button type="button" className={styles.resourceAction} onClick={() => setFontChooserOpen((open) => !open)}>
                  {fontChooserOpen ? t("customResources.closeFontChooser") : t("customResources.addFont")}
                </button>
              </div>
              {fontFeedback ? <p className={styles.status} role={fontFeedback.kind === "conflict" ? "alert" : undefined}>{fontFeedback.kind === "added" ? t("customResources.fontAdded", { family: fontFeedback.family }) : fontFeedback.kind === "merged" ? t("customResources.fontMerged", { count: fontFeedback.count ?? 0, family: fontFeedback.family }) : fontFeedback.kind === "unchanged" ? t("customResources.fontUnchanged", { family: fontFeedback.family }) : t("customResources.fontConflict", { family: fontFeedback.family })}</p> : null}
              {fontChooserOpen ? <MasterFontChooser loadState={fontLoadState} onRetry={loadFonts} onAdd={addLibraryFont} /> : null}
            </div>
          </InspectorSection>
        </section>

        <section className={styles.scope} aria-labelledby="custom-resources-this-presentation">
          <h2 id="custom-resources-this-presentation" className={styles.sectionTitle}>{t("customResources.thisPresentation")}</h2>
          <div className={styles.group}>
            <h3 className={styles.groupTitle}>{t("customResources.palettes")}</h3>
            {presentationColors.length === 0 ? <p className={styles.status}>{t("customResources.noPresentationColors")}</p> : null}
            <div className={styles.localColorList} data-presentation-palette>
              {presentationColors.map((color) => (
                <LocalPresentationColorRow
                  key={color.id}
                  color={color}
                  onUpdate={onUpdatePresentationColor}
                  onRemove={onRemovePresentationColor}
                />
              ))}
            </div>
            <span className={styles.colorCount}>{t("customResources.colorCount", { count: presentationColors.length })}</span>
            <button type="button" className={styles.resourceAction} onClick={() => setLocalColorAddOpen((open) => !open)}>
              {localColorAddOpen ? t("customResources.closePaletteChooser") : t("customResources.addToPresentation")}
            </button>
            {localColorAddOpen ? (
              <div className={styles.localColorAdd}>
                <label className={styles.localColorName}>
                  <span>{t("customResources.colorName")}</span>
                  <input data-presentation-color-name-input value={colorName} onChange={(event) => setColorName(event.target.value)} />
                </label>
                <LiteralColorInput id="custom-resources-literal-color" name={t("customResources.color")} value={colorValue} onChange={setColorValue} />
                <button type="button" className={styles.resourceAction} disabled={!colorName.trim()} onClick={addIndividualColor}>{t("customResources.addColor")}</button>
              </div>
            ) : null}
            <h3 className={styles.groupTitle}>{t("customResources.fonts")}</h3>
            {presentationFonts.length === 0 ? <p className={styles.status}>{t("customResources.noPresentationFonts")}</p> : null}
            <div className={styles.localFontList} data-presentation-fonts>
              {presentationFonts.map((font) => <LocalPresentationFontRow key={font.id} font={font} inUse={isPresentationFontInUse(font.family)} onRemove={onRemovePresentationFont} />)}
            </div>
            <span className={styles.colorCount}>{t(presentationFonts.length === 1 ? "customResources.fontCountOne" : "customResources.fontCountMany", { count: presentationFonts.length })}</span>
            <TypographyStylesWorkspace
              presentationStyles={presentationTypographyStyles}
              presentationFonts={presentationFonts}
              onEdit={(id) => setEditingStyleId(editingStyleId === id ? null : id)}
              editingStyleId={editingStyleId}
              onUpdateFundamental={onUpdateFundamentalTypographyStyle}
              onResetFundamental={onResetFundamentalTypographyStyle}
              onAdd={() => setAddingStyle(true)}
              adding={addingStyle}
              onCancelAdd={() => setAddingStyle(false)}
              onCreate={(name, role) => { onAddTypographyStyle(name, role); setAddingStyle(false); }}
              onUpdate={onUpdateTypographyStyle}
              onRemove={onRemoveTypographyStyle}
              isInUse={isTypographyStyleInUse}
            />
          </div>
        </section>
      </div>
    </aside>
  );
}

function TypographyStylesWorkspace({
  presentationStyles, presentationFonts, editingStyleId, onEdit, onUpdateFundamental, onResetFundamental,
  onAdd, adding, onCancelAdd, onCreate, onUpdate, onRemove, isInUse,
}: {
  presentationStyles: readonly TypographyStyle[];
  presentationFonts: readonly FontResource[];
  editingStyleId: string | null;
  onEdit: (id: string) => void;
  onUpdateFundamental: (id: "title" | "subtitle" | "body" | "caption", typography: TypographyStyleProperties) => void;
  onResetFundamental: (id: "title" | "subtitle" | "body" | "caption") => void;
  onAdd: () => void;
  adding: boolean;
  onCancelAdd: () => void;
  onCreate: (name: string, role: TypographyStyleRole) => void;
  onUpdate: (id: string, patch: { name?: string; role?: TypographyStyleRole; typography?: TypographyStyleProperties }) => void;
  onRemove: (id: string) => void;
  isInUse: (id: string) => boolean;
}) {
  const { t } = useStudioI18n();
  const projectedStyles = listPresentationTypographyStyles({ typographyStyles: presentationStyles });
  const byId = new Map(projectedStyles.filter((item) => item.style !== undefined).map((item) => [item.id, item.style]));
  const customStyles = projectedStyles.filter((item) => !FUNDAMENTAL_TYPOGRAPHY_STYLE_IDS.some((fundamentalId) => fundamentalId === item.id) && item.style !== undefined).map((item) => item.style as TypographyStyle);
  return <section
    className={styles.typographyStylesSection}
    data-presentation-typography-styles
    aria-labelledby="presentation-typography-styles-title"
  >
    <h3 id="presentation-typography-styles-title" className={styles.groupTitle}>{t("customResources.typographyStyles")}</h3>
    <div className={styles.typographyStyleList}>
      {FUNDAMENTAL_TYPOGRAPHY_STYLE_IDS.map((id) => {
        const style = byId.get(id);
        return <TypographyStyleRow key={id} id={id} label={t(`customResources.role.${id}`)} status={style ? t("customResources.customized") : t("customResources.builtIn")} editing={editingStyleId === id} style={style} fonts={presentationFonts} onEdit={onEdit} onUpdateTypography={(typography) => onUpdateFundamental(id, typography)} onReset={() => onResetFundamental(id)} />;
      })}
      {customStyles.map((style) => <TypographyStyleRow key={style.id} id={style.id} label={"name" in style ? style.name : style.id} status={isInUse(style.id) ? t("customResources.inUse") : ("role" in style ? t(`customResources.role.${style.role}`) : "")} editing={editingStyleId === style.id} style={style} fonts={presentationFonts} onEdit={onEdit} onUpdateCustom={(patch) => onUpdate(style.id, patch)} onRemove={() => onRemove(style.id)} removeDisabled={isInUse(style.id)} />)}
    </div>
    {adding ? <NewTypographyStyleForm fonts={presentationFonts} onCancel={onCancelAdd} onCreate={onCreate} /> : <button type="button" className={styles.resourceAction} onClick={onAdd}>{t("customResources.addStyle")}</button>}
  </section>;
}

function TypographyStyleRow({ id, label, status, editing, style, fonts, onEdit, onUpdateTypography, onUpdateCustom, onReset, onRemove, removeDisabled }: {
  id: string; label: string; status: string; editing: boolean; style?: TypographyStyle; fonts: readonly FontResource[];
  onEdit: (id: string) => void; onUpdateTypography?: (value: TypographyStyleProperties) => void; onUpdateCustom?: (value: { name?: string; role?: TypographyStyleRole; typography?: TypographyStyleProperties }) => void;
  onReset?: () => void; onRemove?: () => void; removeDisabled?: boolean;
}) {
  const { t } = useStudioI18n();
  const fundamental = FUNDAMENTAL_TYPOGRAPHY_STYLE_IDS.some((fundamentalId) => fundamentalId === id);
  const role = fundamental ? id as TypographyStyleRole : (style && "role" in style ? style.role : "body");
  const typography = style?.typography;
  const previewText: TextElement = {
    id: `typography-style-preview-${id}`,
    type: "text",
    hidden: false,
    variant: role,
    content: "Aa",
    typography: {
      ...TEXT_VARIANT_TYPOGRAPHY_DEFAULTS[role],
      ...typography,
    },
  };
  const editorId = `typography-style-${id}-editor`;

  return <div className={styles.typographyStyleRow} data-typography-style-id={id}>
    <div className={styles.typographyStyleHeader}>
      <button
        type="button"
        className={styles.typographyStyleDisclosure}
        aria-expanded={editing}
        aria-controls={editorId}
        onClick={() => onEdit(id)}
      >
        <span className={styles.typographyStyleDetails}>
          <strong>{label}</strong>
          <span className={styles.typographyStyleStatus}>{status}</span>
        </span>
        <span className={styles.typographyStyleChevron} aria-hidden="true">{editing ? "▾" : "▸"}</span>
      </button>
    </div>
    {editing ? <div id={editorId} className={styles.typographyStyleEditor}>
      <div
        className={styles.typographyStylePreview}
        data-typography-style-preview={id}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: renderElement(previewText) }}
      />
      {!fundamental && style && "name" in style ? <CustomTypographyStyleNameInput canonicalName={style.name} onCommit={(name) => onUpdateCustom?.({ name })} /> : null}
      {!fundamental && <label className={styles.localColorName}><span>{t("customResources.role")}</span><select value={role} onChange={(event) => onUpdateCustom?.({ role: event.target.value as TypographyStyleRole })}>{FUNDAMENTAL_TYPOGRAPHY_STYLE_IDS.map((roleId) => <option key={roleId} value={roleId}>{t(`customResources.role.${roleId}`)}</option>)}</select></label>}
      <ElementTypographyFields typography={typography} effectiveDefaults={TEXT_VARIANT_TYPOGRAPHY_DEFAULTS[role]} fontResources={fonts} controlPrefix={`typography-style-${id}`} onUpdateTypography={(update) => (fundamental ? onUpdateTypography?.(normalizeTypographyStyleProperties(update(typography))) : onUpdateCustom?.({ typography: normalizeTypographyStyleProperties(update(typography)) }))} />
      {fundamental && style && onReset ? <div className={styles.typographyStyleActions}><button type="button" className={styles.resourceAction} onClick={onReset}>{t("customResources.reset")}</button></div> : null}
      {!fundamental && onRemove ? <div className={styles.typographyStyleActions}><button type="button" className={styles.resourceAction} disabled={removeDisabled} onClick={onRemove}>{t("customResources.remove")}</button></div> : null}
    </div> : null}
  </div>;
}

function CustomTypographyStyleNameInput({ canonicalName, onCommit }: { canonicalName: string; onCommit: (name: string) => void }) {
  const { t } = useStudioI18n();
  const [draft, setDraft] = useState(canonicalName);
  const [lastCanonicalName, setLastCanonicalName] = useState(canonicalName);
  if (canonicalName !== lastCanonicalName) {
    setLastCanonicalName(canonicalName);
    setDraft(canonicalName);
  }
  const commit = () => {
    const next = draft.trim();
    if (!next || next === canonicalName) {
      setDraft(canonicalName);
      return;
    }
    onCommit(next);
  };
  return <label className={styles.localColorName}><span>{t("customResources.styleName")}</span><input value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); event.currentTarget.blur(); } }} /></label>;
}

function NewTypographyStyleForm({ fonts, onCancel, onCreate }: { fonts: readonly FontResource[]; onCancel: () => void; onCreate: (name: string, role: TypographyStyleRole) => void }) {
  const { t } = useStudioI18n();
  const [name, setName] = useState("");
  const [role, setRole] = useState<TypographyStyleRole>("body");
  return <div className={styles.localColorAdd} data-new-typography-style>
    <label className={styles.localColorName}><span>{t("customResources.styleName")}</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label className={styles.localColorName}><span>{t("customResources.role")}</span><select value={role} onChange={(event) => setRole(event.target.value as TypographyStyleRole)}>{FUNDAMENTAL_TYPOGRAPHY_STYLE_IDS.map((roleId) => <option key={roleId} value={roleId}>{t(`customResources.role.${roleId}`)}</option>)}</select></label>
    <button type="button" className={styles.resourceAction} disabled={!name.trim()} onClick={() => onCreate(name, role)}>{t("customResources.addStyle")}</button>
    <button type="button" className={styles.resourceAction} onClick={onCancel}>{t("customResources.close")}</button>
  </div>;
}

function LocalPresentationColorRow({
  color,
  onUpdate,
  onRemove,
}: {
  color: PresentationPaletteColor;
  onUpdate: (id: string, patch: { name: string; value: Color }) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useStudioI18n();
  const [nameDraft, setNameDraft] = useState(color.name);
  const [lastCanonicalName, setLastCanonicalName] = useState(color.name);

  if (color.name !== lastCanonicalName) {
    setLastCanonicalName(color.name);
    setNameDraft(color.name);
  }

  const commitName = () => {
    const nextName = nameDraft.trim();
    if (!nextName || nextName === color.name) {
      setNameDraft(color.name);
      return;
    }
    onUpdate(color.id, { name: nextName, value: color.value });
  };

  return (
    <div className={styles.localColorItem} data-presentation-color-row>
      <input
        className={styles.localColorInlineName}
        aria-label={t("customResources.colorNameFor", { name: color.name })}
        value={nameDraft}
        onChange={(event) => setNameDraft(event.target.value)}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitName();
            event.currentTarget.blur();
          }
        }}
      />
      <div className={styles.localColorValueRow}>
        <LiteralColorInput id={`custom-resources-literal-color-${color.id}`} name={t("customResources.color")} value={color.value} onChange={(value) => onUpdate(color.id, { name: color.name, value })} />
        <button type="button" className={styles.removeColor} aria-label={t("customResources.removePresentationColor", { name: color.name })} onClick={() => onRemove(color.id)}>×</button>
      </div>
    </div>
  );
}

function MasterPaletteChooser({
  loadState,
  onRetry,
  onAdd,
}: {
  loadState: PaletteLoadState;
  onRetry: () => void;
  onAdd: (palette: CustomLibraryPaletteDraft) => CustomLibraryPaletteAddOutcome;
}) {
  const { t } = useStudioI18n();

  if (loadState.kind === "loading") return <p className={styles.status}>{t("customResources.loadingPalettes")}</p>;
  if (loadState.kind === "error") return <div className={styles.statusGroup}><p className={styles.status} role="alert">{t("customResources.loadFailed")}</p><button type="button" className={styles.retryButton} onClick={onRetry}>{t("customResources.retry")}</button></div>;
  if (loadState.records.length === 0) return <p className={styles.status}>{t("customResources.noLibraryPalettes")}</p>;

  return (
    <div className={styles.masterPaletteList}>
      {loadState.records.map(({ id, palette }) => (
        <div key={id} className={styles.masterPaletteRow} data-custom-resource-palette={id}>
          <strong>{palette.name}</strong>
          <ColorSwatches colors={palette.colors} />
          <span className={styles.masterPaletteCount}>{t("customResources.colorCount", { count: palette.colors.length })}</span>
          <button type="button" className={styles.resourceAction} aria-label={t("customResources.addMasterPalette", { name: palette.name })} onClick={() => onAdd(palette)}>+</button>
        </div>
      ))}
    </div>
  );
}

function MasterFontChooser({
  loadState,
  onRetry,
  onAdd,
}: {
  loadState: FontLoadState;
  onRetry: () => void;
  onAdd: (font: CustomLibraryFontDraft) => void;
}) {
  const { t } = useStudioI18n();

  if (loadState.kind === "loading") return <p className={styles.status}>{t("customResources.loadingFonts")}</p>;
  if (loadState.kind === "error") return <div className={styles.statusGroup}><p className={styles.status} role="alert">{t("customResources.fontLoadFailed")}</p><button type="button" className={styles.retryButton} onClick={onRetry}>{t("customResources.retry")}</button></div>;
  if (loadState.records.length === 0) return <p className={styles.status}>{t("customResources.noLibraryFonts")}</p>;

  return <div className={styles.masterFontList}>
    {loadState.records.map(({ id, font }) => <div key={id} className={styles.masterFontRow} data-custom-resource-font={id}>
      <strong>{font.family}</strong>
      <span className={styles.masterPaletteCount}>{t(font.faces.length === 1 ? "customResources.faceCountOne" : "customResources.faceCountMany", { count: font.faces.length })}</span>
      <button type="button" className={styles.resourceAction} aria-label={t("customResources.addMasterFont", { family: font.family })} onClick={() => onAdd(font)}>+</button>
    </div>)}
  </div>;
}

function LocalPresentationFontRow({
  font,
  inUse,
  onRemove,
}: {
  font: FontResource;
  inUse: boolean;
  onRemove: (id: string) => CustomLibraryFontRemoveOutcome;
}) {
  const { t } = useStudioI18n();
  const faces = getFontResourceFaces(font);

  return <div className={styles.localFontRow} data-presentation-font-row>
    <div className={styles.localFontDetails}>
      <strong>{font.family}</strong>
      <span className={styles.masterPaletteCount}>{t(faces.length === 1 ? "customResources.faceCountOne" : "customResources.faceCountMany", { count: faces.length })}{inUse ? ` · ${t("customResources.inUse")}` : ""}</span>
    </div>
    <button type="button" className={styles.removeColor} aria-label={t("customResources.removePresentationFont", { family: font.family })} disabled={inUse} onClick={() => onRemove(font.id)}>×</button>
  </div>;
}

function ColorSwatches({ colors }: { colors: readonly { name: string; value: string }[] }) {
  const visibleColors = colors.slice(0, PREVIEW_COLOR_LIMIT);
  const remainingCount = colors.length - visibleColors.length;

  return (
    <div className={styles.swatches} aria-hidden="true">
      {visibleColors.map((color, index) => <span key={`${color.name}-${index}`} className={styles.swatch} data-palette-swatch style={{ backgroundColor: color.value }} />)}
      {remainingCount > 0 ? <span className={styles.moreSwatches}>+{remainingCount}</span> : null}
    </div>
  );
}
