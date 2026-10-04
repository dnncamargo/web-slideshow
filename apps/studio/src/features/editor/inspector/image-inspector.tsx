import type {
  ElementEffect,
  ImageVisualStyle,
  PresentationFileResource,
  PresentationElement,
} from "@web-slideshow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import { InspectorSection } from "./inspector-section";

import type { TypedInspectorProps } from "./inspector-types";

import { ImageSizeSection } from "./sections/image-size-section";
import { CanonicalImageAppearanceSection } from "./sections/canonical-image-appearance-section";
import { CanonicalImageEffectsSection } from "./sections/canonical-image-effects-section";
import { ImageCropControl, ImageFocalPointControl } from "./sections/image-crop-control";
import { ElementSpacingSection } from "./sections/element-spacing-section";
import { useAuthoringHistory } from "../authoring-history-context";

type ImageElement = Extract<PresentationElement, { type: "image" }>;
const DEFAULT_DIRECT_IMAGE_SOURCE = "/instance-demo.svg";

// ============================================================
// BEGIN: IMAGE INSPECTOR
// ============================================================

export function ImageInspector({
  element,
  onUpdate,
  preserveImageProportion,
  onPreserveImageProportionChange,
  focalEditing,
  onFocalEditingChange,
  cropEditing = false,
  onCropEditingChange = () => {},
  presentationFiles = [],
}: TypedInspectorProps<ImageElement> & {
  preserveImageProportion: boolean;
  onPreserveImageProportionChange: (value: boolean) => void;
  focalEditing: boolean;
  onFocalEditingChange: (editing: boolean) => void;
  cropEditing?: boolean;
  onCropEditingChange?: (editing: boolean) => void;
  presentationFiles?: readonly PresentationFileResource[];
}) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const textEditMeta = { kind: "text.edit", labelKey: "history.text.edit" } as const;
  const updateImageText = (field: "src" | "alt", value: string): void => {
    const currentValue = field === "src"
      ? ("src" in element ? element.src : "")
      : element.alt;
    if (value === currentValue) return;

    const historyKey = `text:image-${element.id}-${field}`;
    const update = () => onUpdate((current) => {
      if (current.type !== "image") return current;
      return field === "src"
        ? "src" in current
          ? { ...current, src: value }
          : current
        : { ...current, alt: value };
    });

    if (!authoringHistory) {
      update();
      return;
    }

    authoringHistory.begin(historyKey, textEditMeta);
    authoringHistory.update(historyKey, update);
  };
  const runDiscrete = (callback: () => void): void => {
    const meta = { kind: "element.setting", labelKey: "history.element.setting", labelParams: { setting: "image.fit" } } as const;
    if (authoringHistory) authoringHistory.discrete(meta, callback);
    else callback();
  };

  const imageFiles = presentationFiles.filter((file) => file.kind === "image" && file.representation === "binary");
  const fileSource = "fileResourceId" in element;
  const selectedFile = fileSource
    ? imageFiles.find((file) => file.id === element.fileResourceId)
    : undefined;
  const updateSource = (value: string): void => {
    runDiscrete(() => onUpdate((current) => {
      if (current.type !== "image") return current;
      if (value === "direct") {
        if ("src" in current) return current;
        const { fileResourceId: _fileResourceId, ...directBase } = current;
        return { ...directBase, src: DEFAULT_DIRECT_IMAGE_SOURCE };
      }
      if ("src" in current) {
        const { src: _src, ...resourceBase } = current;
        return { ...resourceBase, fileResourceId: value };
      }
      return { ...current, fileResourceId: value };
    }));
  };

  const updateStyle = (
    update: (style: ImageVisualStyle | undefined) => ImageVisualStyle,
  ) => {
    onUpdate((current) => {
      if (current.type !== "image") {
        return current;
      }
      return { ...current, style: update(current.style) };
    });
  };

  const updateEffect = (
    update: (effect: ElementEffect | undefined) => ElementEffect,
  ) => {
    onUpdate((current) => {
      if (current.type !== "image") return current;
      return { ...current, effect: update(current.effect) };
    });
  };
  return (
    <>
      <div className={styles.inspectorDivider} />

      <InspectorSection title={t("inspector.source")} defaultOpen>
        <label className={styles.field}>
          <span>{t("image.sourceMode")}</span>
          <select
            id="image-source-mode"
            name="imageSourceMode"
            value={fileSource ? element.fileResourceId : "direct"}
            onChange={(event) => updateSource(event.target.value)}
          >
            <option value="direct">{t("image.directSource")}</option>
            {imageFiles.map((file) => (
              <option key={file.id} value={file.id}>{file.name}</option>
            ))}
          </select>
          {fileSource ? (
            <small className={styles.fieldHint}>
              <span>{selectedFile?.name ?? element.fileResourceId}</span>
            </small>
          ) : null}
        </label>

        <label className={styles.field}>
          <span>{t("inspector.source")}</span>

          <textarea
            id="image-src"
            name="imageSrc"
            className={styles.textArea}
            rows={3}
            spellCheck={false}
            value={"src" in element ? element.src : ""}
            disabled={fileSource}
            onFocus={() => authoringHistory?.begin(`text:image-${element.id}-src`, textEditMeta)}
            onBlur={() => authoringHistory?.finish(`text:image-${element.id}-src`)}
            onChange={(event) => {
              updateImageText("src", event.target.value);
            }}
          />

          <small className={styles.fieldHint}>
            <span>{t("image.sourceHint")}</span>
          </small>
        </label>

        <label className={styles.field}>
          <span>{t("image.alternativeText")}</span>

          <textarea
            id="image-alt"
            name="imageAlt"
            className={styles.textArea}
            rows={3}
            value={element.alt}
            onFocus={() => authoringHistory?.begin(`text:image-${element.id}-alt`, textEditMeta)}
            onBlur={() => authoringHistory?.finish(`text:image-${element.id}-alt`)}
            onChange={(event) => {
              updateImageText("alt", event.target.value);
            }}
          />
        </label>

        <label className={styles.field}>
          <span>{t("image.fit")}</span>

          <select
            id="image-fit"
            name="imageFit"
            value={element.fit}
            onChange={(event) => {
              const fit = event.target.value as ImageElement["fit"];
              if (fit === element.fit) return;
              runDiscrete(() => onUpdate((current) => current.type === "image" ? { ...current, fit } : current));
            }}
          >
            <option value="contain">{t("image.contain")}</option>

            <option value="cover">{t("image.cover")}</option>

            <option value="fill">{t("image.fill")}</option>
          </select>
        </label>

        <ImageCropControl crop={element.crop} idPrefix="image" onCropChange={(crop) => onUpdate((current) => current.type === "image" ? { ...current, crop } : current)} onResetCrop={() => onUpdate((current) => current.type === "image" ? { ...current, crop: undefined } : current)} canvasEdit={{ editing: cropEditing, onEditingChange: onCropEditingChange }} />
        <ImageFocalPointControl focalPoint={element.focalPoint} idPrefix="image" onFocalPointChange={(focalPoint) => onUpdate((current) => current.type === "image" ? { ...current, focalPoint } : current)} onResetFocalPoint={() => onUpdate((current) => current.type === "image" ? { ...current, focalPoint: undefined } : current)} canvasEdit={{ editing: focalEditing, onEditingChange: onFocalEditingChange }} />
       </InspectorSection>

       <ImageSizeSection
         element={element}
         onUpdateLayout={(update) => {
           onUpdate((current) =>
             current.type === "image"
               ? { ...current, layout: update(current.layout) }
               : current,
           );
         }}
         preserveImageProportion={preserveImageProportion}
         onPreserveImageProportionChange={onPreserveImageProportionChange}
       />

       <ElementSpacingSection
         layout={element.layout}
         controlPrefix="image"
         onUpdateLayout={(update) => {
           onUpdate((current) =>
             current.type === "image"
               ? { ...current, layout: update(current.layout) }
               : current,
           );
         }}
       />

       <CanonicalImageAppearanceSection
        style={element.style}
        effect={element.effect}
        onUpdateStyle={updateStyle}
        onUpdateEffect={updateEffect}
      />

      <CanonicalImageEffectsSection
        effect={element.effect}
        onUpdateEffect={updateEffect}
      />

    </>
  );
}

// ============================================================
// END: IMAGE INSPECTOR
// ============================================================
