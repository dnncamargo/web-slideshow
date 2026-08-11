import { getFontResourceFaces, type FontResource } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

interface RegisteredFontListProps {
  fontResources: readonly FontResource[];
  isFontFamilyInUse: (family: string) => boolean;
  onRemoveFontFace: (fontResourceId: string, faceIndex: number) => void;
}

export function RegisteredFontList({
  fontResources,
  isFontFamilyInUse,
  onRemoveFontFace,
}: RegisteredFontListProps) {
  const { t } = useStudioI18n();

  return (
    <>
      <span className={styles.appearanceSubheading}>
        {t("inspector.registeredFonts")}
      </span>

      {fontResources.length === 0 ? (
        <span className={styles.fontResourceEmpty}>
          {t("inspector.noRegisteredFonts")}
        </span>
      ) : (
        <div className={styles.fontResourceList}>
          {fontResources.map((fontResource) => {
            const faces = getFontResourceFaces(fontResource);
            const inUse = isFontFamilyInUse(fontResource.family);
            const isLegacy = fontResource.faces === undefined;

            return (
              <div className={styles.fontResourceRow} key={fontResource.id}>
                <div className={styles.fontResourceHeader}>
                  <strong>{fontResource.family}</strong>

                  {inUse && (
                    <span className={styles.fontResourceStatus}>
                      {t("inspector.inUse")}
                    </span>
                  )}
                </div>

                <div className={styles.fontFaceList}>
                  {faces.map((face, faceIndex) => {
                    const faceDetails = [
                      face.weight ?? t("inspector.default"),
                      face.style === undefined
                        ? t("inspector.default")
                        : t(`inspector.fontStyle.${face.style}`),
                      face.subset,
                      face.source.format?.toUpperCase(),
                      isLegacy ? t("inspector.legacyFace") : undefined,
                    ].filter((detail) => detail !== undefined);
                    const lastFaceInUse = inUse && faces.length === 1;

                    return (
                      <div
                        className={styles.fontFaceRow}
                        key={`${fontResource.id}-${faceIndex}`}
                      >
                        <span className={styles.fontFaceMeta}>
                          {faceDetails.join(" · ")}
                        </span>

                        <button
                          className={styles.secondaryButton}
                          type="button"
                          disabled={lastFaceInUse}
                          onClick={() => {
                            if (!lastFaceInUse) {
                              onRemoveFontFace(fontResource.id, faceIndex);
                            }
                          }}
                        >
                          {t("inspector.removeFace")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

