import { useRef, useState } from "react";

import {
  FontFaceResourceSchema,
  type FontFaceResource,
} from "@web-slideshow/document-schema";

import { uploadManagedAsset } from "@/features/persistence/managed-asset-storage";
import {
  classifyManagedAssetFilename,
  type ManagedAssetContentType,
} from "@/features/persistence/managed-asset-content-types";
import type { StudioMessageKey } from "@/features/i18n/studio-i18n";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import {
  FirebaseAuthenticationError,
  ManagedAssetUploadError,
} from "@/features/persistence/persistence-errors";

import { normalizeFontFamily } from "../font-face-helpers";
import styles from "./font-acquisition.module.css";
import {
  fontFacePersistenceFailed,
  fontFaceWasSaved,
  type FontFamilyFaces,
  type OnAddFontFace,
} from "../font-acquisition-types";

interface FontFileUploadControlProps {
  fontFamilies: readonly FontFamilyFaces[];
  onAddFontFace: OnAddFontFace;
  onFontAdded: (family: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
  onRetryFontFacePersistence?: OnAddFontFace;
  onPhysicalUpload?: () => void;
  controlPrefix: string;
}

type FontFaceStyle = NonNullable<FontFaceResource["style"]>;
type FontFaceFormat = NonNullable<FontFaceResource["source"]["format"]>;
type FontFaceSlot = Pick<
  FontFaceResource,
  "weight" | "style" | "subset" | "unicodeRange"
>;
type UploadState = "idle" | "uploading" | "saving";

interface PendingFontPersistence {
  family: string;
  face: FontFaceResource;
  persistenceId: string;
}

const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

function resolveFontFile(file: File): {
  format: FontFaceFormat;
  contentType: ManagedAssetContentType;
} | null {
  const classification = classifyManagedAssetFilename(file.name);
  if (
    classification?.category !== "font" ||
    classification.fontFormat === undefined ||
    (classification.extension !== ".ttf" &&
      classification.extension !== ".otf" &&
      classification.extension !== ".woff2")
  ) return null;

  return {
    format: classification.fontFormat,
    contentType: classification.contentType,
  };
}

function areFontFaceSlotsEquivalent(
  first: FontFaceSlot,
  second: FontFaceSlot,
): boolean {
  return (
    first.weight === second.weight &&
    first.style === second.style &&
    first.subset === second.subset &&
    first.unicodeRange === second.unicodeRange
  );
}

export function FontFileUploadControl({
  fontFamilies,
  onAddFontFace,
  onFontAdded,
  onUploadingChange,
  onRetryFontFacePersistence,
  onPhysicalUpload,
  controlPrefix,
}: FontFileUploadControlProps) {
  const { t } = useStudioI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [family, setFamily] = useState("");
  const [weight, setWeight] = useState(400);
  const [fontStyle, setFontStyle] = useState<FontFaceStyle>("normal");
  const [subset, setSubset] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<StudioMessageKey | null>(null);
  const [pendingPersistence, setPendingPersistence] = useState<PendingFontPersistence | null>(null);

  function uploadErrorMessage(error: unknown): StudioMessageKey {
    if (error instanceof FirebaseAuthenticationError) return "customLibrary.uploadError.authentication";
    if (error instanceof ManagedAssetUploadError) {
      switch (error.category) {
        case "unsupported_type": return "customLibrary.uploadError.unsupportedType";
        case "file_too_large": return "customLibrary.uploadError.fileTooLarge";
        case "store_suspended": return "customLibrary.uploadError.storeSuspended";
        case "authorization": return "customLibrary.uploadError.authorization";
        case "rate_limited": return "customLibrary.uploadError.rateLimited";
        case "service_unavailable": return "customLibrary.uploadError.serviceUnavailable";
        case "network": return "customLibrary.uploadError.network";
        case "uncertain_completion": return "customLibrary.uploadError.uncertainCompletion";
        case "quota_exceeded": return "customLibrary.uploadError.quotaExceeded";
        case "unknown": return "customLibrary.uploadError.unknown";
      }
    }
    return "customLibrary.uploadError.unknown";
  }

  async function addFontFace() {
    if (pendingPersistence) {
      if (!onRetryFontFacePersistence) {
        setError("customLibrary.uploadError.unknown");
        return;
      }
      setError(null);
      setState("saving");
      onUploadingChange?.(true);
      try {
        const result = await onRetryFontFacePersistence(
          pendingPersistence.family,
          pendingPersistence.face,
          pendingPersistence.persistenceId,
        );
        if (fontFaceWasSaved(result)) {
          onFontAdded(pendingPersistence.family);
          setPendingPersistence(null);
          setFamily("");
          setWeight(400);
          setFontStyle("normal");
          setSubset("");
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          setError(null);
        } else if (fontFacePersistenceFailed(result)) {
          setError("customLibrary.uploadError.persistenceFailed");
        } else {
          setPendingPersistence(null);
          setError("inspector.fontFaceExists");
        }
      } finally {
        setState("idle");
        onUploadingChange?.(false);
      }
      return;
    }

    const trimmedFamily = family.trim();
    const trimmedSubset = subset.trim();

    if (!trimmedFamily) {
      setError("inspector.fontFamilyRequired");
      return;
    }

    if (!file) {
      setError("customLibrary.fontManagement.fontFileRequired");
      return;
    }

    const resolvedFile = resolveFontFile(file);

    if (!resolvedFile) {
      setError("customLibrary.fontManagement.unsupportedFontFile");
      return;
    }

    const normalizedFamily = normalizeFontFamily(trimmedFamily);
    const existingResource = fontFamilies.find(
      (fontFamily) => normalizeFontFamily(fontFamily.family) === normalizedFamily,
    );
    const candidateFace: FontFaceSlot = {
      weight,
      style: fontStyle,
      ...(trimmedSubset ? { subset: trimmedSubset } : {}),
    };
    const duplicate = existingResource?.faces.some((face) =>
      areFontFaceSlotsEquivalent(face, candidateFace),
    );

    if (duplicate) {
      setError("inspector.fontFaceExists");
      return;
    }

    setError(null);
    setState("uploading");
    onUploadingChange?.(true);

    try {
      let upload: Awaited<ReturnType<typeof uploadManagedAsset>>;

      try {
        upload = await uploadManagedAsset(file, {
          contentType: resolvedFile.contentType,
        });
      } catch (error) {
        setError(uploadErrorMessage(error));
        return;
      }
      onPhysicalUpload?.();

      const result = FontFaceResourceSchema.safeParse({
        ...candidateFace,
        source: {
          type: "url",
          url: upload.downloadUrl,
          format: resolvedFile.format,
        },
      });

      if (!result.success) {
        setError("customLibrary.fontManagement.uploadFailed");
        return;
      }

      const resourceFamily = existingResource?.family ?? trimmedFamily;
      const added = await onAddFontFace(resourceFamily, result.data, upload.assetId);

      if (fontFacePersistenceFailed(added)) {
        setPendingPersistence({
          family: resourceFamily,
          face: result.data,
          persistenceId: upload.assetId,
        });
        setError("customLibrary.uploadError.persistenceFailed");
        return;
      }

      if (!fontFaceWasSaved(added)) {
        return;
      }

      onFontAdded(resourceFamily);
      setFamily("");
      setWeight(400);
      setFontStyle("normal");
      setSubset("");
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setError(null);
    } finally {
      setState("idle");
      onUploadingChange?.(false);
    }
  }

  const uploading = state !== "idle";

  return (
    <div className={styles.fontSourcePanel}>
      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span>{t("inspector.family")}</span>
          <input
            id={`${controlPrefix}-family`}
            name={`${controlPrefix}-family`}
            type="text"
            value={family}
            disabled={uploading}
            onChange={(event) => {
              setFamily(event.target.value);
              setError(null);
            }}
          />
        </label>

        <label className={styles.field}>
          <span>{t("inspector.fontWeight")}</span>
          <select
            id={`${controlPrefix}-weight`}
            name={`${controlPrefix}-weight`}
            value={weight}
            disabled={uploading}
            onChange={(event) => {
              const selectedWeight = Number(event.target.value);

              if (FONT_WEIGHTS.some((value) => value === selectedWeight)) {
                setWeight(selectedWeight);
              }
            }}
          >
            {FONT_WEIGHTS.map((fontWeight) => (
              <option key={fontWeight} value={fontWeight}>
                {fontWeight}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span>{t("inspector.fontStyle")}</span>
          <select
            id={`${controlPrefix}-style`}
            name={`${controlPrefix}-style`}
            value={fontStyle}
            disabled={uploading}
            onChange={(event) => {
              const selectedStyle = event.target.value;

              if (selectedStyle === "normal" || selectedStyle === "italic") {
                setFontStyle(selectedStyle);
              }
            }}
          >
            <option value="normal">{t("inspector.fontStyle.normal")}</option>
            <option value="italic">{t("inspector.fontStyle.italic")}</option>
          </select>
        </label>

        <label className={styles.field}>
          <span>{t("inspector.subset")}</span>
          <input
            id={`${controlPrefix}-subset`}
            name={`${controlPrefix}-subset`}
            type="text"
            value={subset}
            disabled={uploading}
            onChange={(event) => {
              setSubset(event.target.value);
              setError(null);
            }}
          />
        </label>
      </div>

      <label className={styles.field}>
        <span>{t("customLibrary.fontManagement.fontFile")}</span>
        <input
          ref={fileInputRef}
          id={`${controlPrefix}-file`}
          name={`${controlPrefix}-file`}
          type="file"
          accept=".ttf,.otf,.woff2,font/ttf,font/otf,font/woff2"
          disabled={uploading}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setError(null);
          }}
        />
      </label>

      <button
        id={`${controlPrefix}-submit`}
        className={styles.secondaryButton}
        type="button"
        disabled={uploading}
        onClick={() => {
          void addFontFace();
        }}
      >
        {uploading
          ? t(
              pendingPersistence
                ? "customLibrary.uploadError.retryingPersistence"
                : "customLibrary.fontManagement.uploading",
            )
          : t(
              pendingPersistence
                ? "customLibrary.uploadError.retryPersistence"
                : "customLibrary.fontManagement.uploadFace",
            )}
      </button>

      {error ? (
        <span className={styles.validationMessage} role="alert">
          {t(error)}
        </span>
      ) : null}
    </div>
  );
}
