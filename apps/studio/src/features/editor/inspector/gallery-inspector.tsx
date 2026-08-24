import type {
  GalleryElement,
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

type GalleryFit = GalleryElement["fit"];

const GALLERY_ITEM_DEFAULT = {
  src: "/powershow-demo.svg",

  alt: "New image",
};

// ============================================================
// BEGIN: GALLERY INSPECTOR
//
// Gallery items are ordered value objects without ids. They are
// mutated immutably by array index and are never treated as
// authoring tree nodes.
// ============================================================

export function GalleryInspector({
  element,
  onUpdate,
}: TypedInspectorProps<GalleryElement>) {
  const { t } = useStudioI18n();

  const updateGallery = (
    update: (gallery: GalleryElement) => GalleryElement,
  ) => {
    onUpdate((current) => {
      if (current.type !== "gallery") {
        return current;
      }

      return update(current);
    });
  };

  const updateStyle: UpdateSurfaceStyle = (update) => {
    updateGallery((gallery) => ({
      ...gallery,

      style: update(gallery.style),
    }));
  };

  const updateItem = (
    targetIndex: number,
    update: (item: GalleryElement["items"][number]) => GalleryElement["items"][number],
  ) => {
    updateGallery((gallery) => ({
      ...gallery,

      items: gallery.items.map((item, index) =>
        index === targetIndex ? update(item) : item,
      ),
    }));
  };

  const addItem = () => {
    updateGallery((gallery) => ({
      ...gallery,

      items: [
        ...gallery.items,

        {
          src: GALLERY_ITEM_DEFAULT.src,

          alt: GALLERY_ITEM_DEFAULT.alt,
        },
      ],
    }));
  };

  const removeItem = (targetIndex: number) => {
    updateGallery((gallery) => ({
      ...gallery,

      items: gallery.items.filter(
        (_item, index) => index !== targetIndex,
      ),
    }));
  };

  const moveItem = (fromIndex: number, toIndex: number) => {
    updateGallery((gallery) => {
      if (fromIndex < 0 || fromIndex >= gallery.items.length) {
        return gallery;
      }

      if (toIndex < 0 || toIndex >= gallery.items.length) {
        return gallery;
      }

      const items = [...gallery.items];

      const [moved] = items.splice(fromIndex, 1);

      if (moved === undefined) {
        return gallery;
      }

      items.splice(toIndex, 0, moved);

      return {
        ...gallery,

        items,
      };
    });
  };

  return (
    <>
      <div className={styles.inspectorDivider} />

      <InspectorSection
        title={t("inspector.content")}
        count={element.items.length}
        defaultOpen
      >
        <label className={styles.field}>
          <span>{t("image.fit")}</span>

          <select
            id="gallery-fit"
            name="galleryFit"
            value={element.fit}
            onChange={(event) => {
              const fit = event.target.value as GalleryFit;

              updateGallery((gallery) => ({
                ...gallery,

                fit,
              }));
            }}
          >
            <option value="contain">{t("image.contain")}</option>

            <option value="cover">{t("image.cover")}</option>

            <option value="fill">{t("image.fill")}</option>
          </select>
        </label>

        <div className={styles.tableEditorList}>
          {element.items.length === 0 && (
            <div className={styles.emptyInspectorList}>
              <span>{t("gallery.items", { count: 0 })}</span>
            </div>
          )}

          {element.items.map((item, index) => (
            <div
              key={index}
              className={styles.tableRowEditor}
              data-powershow-gallery-item="true"
            >
              <div className={styles.tableEditorHeader}>
                <strong>
                  <span>
                    {t("gallery.imageNumber", { number: index + 1 })}
                  </span>
                </strong>

                <div className={styles.galleryItemActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    aria-label={t("gallery.moveUp")}
                    title={t("gallery.moveUp")}
                    disabled={index === 0}
                    data-powershow-gallery-move-up="true"
                    onClick={() => {
                      moveItem(index, index - 1);
                    }}
                  >
                    <span>↑</span>
                  </button>

                  <button
                    type="button"
                    className={styles.secondaryButton}
                    aria-label={t("gallery.moveDown")}
                    title={t("gallery.moveDown")}
                    disabled={index === element.items.length - 1}
                    data-powershow-gallery-move-down="true"
                    onClick={() => {
                      moveItem(index, index + 1);
                    }}
                  >
                    <span>↓</span>
                  </button>

                  <button
                    type="button"
                    className={styles.iconButtonDanger}
                    aria-label={t("gallery.remove")}
                    title={t("gallery.remove")}
                    data-powershow-gallery-remove="true"
                    onClick={() => {
                      removeItem(index);
                    }}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              </div>

              <label className={styles.field}>
                <span>{t("inspector.source")}</span>

                <textarea
                  id={`gallery-${element.id}-item-${index}-src`}
                  name={`galleryItemSrc_${element.id}_${index}`}
                  className={styles.textArea}
                  rows={2}
                  spellCheck={false}
                  value={item.src}
                  data-powershow-gallery-src="true"
                  onChange={(event) => {
                    const src = event.target.value;

                    updateItem(index, (current) => ({
                      ...current,

                      src,
                    }));
                  }}
                />
              </label>

              <label className={styles.field}>
                <span>{t("image.alternativeText")}</span>

                <textarea
                  id={`gallery-${element.id}-item-${index}-alt`}
                  name={`galleryItemAlt_${element.id}_${index}`}
                  className={styles.textArea}
                  rows={2}
                  value={item.alt}
                  data-powershow-gallery-alt="true"
                  onChange={(event) => {
                    const alt = event.target.value;

                    updateItem(index, (current) => ({
                      ...current,

                      alt,
                    }));
                  }}
                />
              </label>
            </div>
          ))}
        </div>

        <button
          type="button"
          className={styles.secondaryButton}
          data-powershow-gallery-add="true"
          onClick={addItem}
        >
          <span>{t("gallery.add")}</span>
        </button>
      </InspectorSection>

      <CanonicalSurfaceAppearanceSection
        element={element}
        style={element.style}
        effect={element.effect}
        onUpdateStyle={updateStyle}
        onUpdateEffect={(update) => updateGallery((gallery) => ({ ...gallery, effect: update(gallery.effect) }))}
        controlPrefix="gallery"
      />

      <CanonicalElementEffectsSection
        effect={element.effect}
        onUpdateEffect={(update) => updateGallery((gallery) => ({ ...gallery, effect: update(gallery.effect) }))}
        controlPrefix="gallery"
      />
    </>
  );
}

// ============================================================
// END: GALLERY INSPECTOR
// ============================================================
