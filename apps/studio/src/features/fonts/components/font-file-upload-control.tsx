import { useRef, useState } from "react";

import {
  FontFaceResourceSchema,
  type FontFaceResource,
} from "@web-slideshow/document-schema";

import { uploadManagedAsset } from "@/features/persistence/managed-asset-storage";
import type { StudioMessageKey } from "@/features/i18n/studio-i18n";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import { normalizeFontFamily } from "../font-face-helpers";
import styles from "./font-acquisition.module.css";
import type { FontFamilyFaces, OnAddFontFace } from "../font-acquisition-types";

interface FontFileUploadControlProps {
  fontFamilies: readonly FontFamilyFaces[];
  onAddFontFace: OnAddFontFace;
  onFontAdded: (family: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
  controlPrefix: string;
}

type FontFaceStyle = NonNullable<FontFaceResource["style"]>;
type FontFaceSlot = Pick<
  FontFaceResource,
  "weight" | "style" | "subset" | "unicodeRange"
>;
type UploadableFontFormat = "truetype" | "woff2";
type UploadState = "idle" | "uploading";

const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

function resolveFontFile(file: File): {
  format: UploadableFontFormat;
  contentType: "font/ttf" | "font/woff2";
} | null {
  const name = file.name.toLowerCase();

  if (name.endsWith(".ttf")) {
    return { format: "truetype", contentType: "font/ttf" };
  }

  if (name.endsWith(".woff2")) {
    return { format: "woff2", contentType: "font/woff2" };
  }

  return null;
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

  async function addFontFace() {
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
      } catch {
        setError("customLibrary.fontManagement.uploadFailed");
        return;
      }

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
      const added = await onAddFontFace(resourceFamily, result.data);

      if (!added) {
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

  const uploading = state === "uploading";

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
          accept=".ttf,.woff2,font/ttf,font/woff2"
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
          ? t("customLibrary.fontManagement.uploading")
          : t("customLibrary.fontManagement.uploadFace")}
      </button>

      {error ? (
        <span className={styles.validationMessage} role="alert">
          {t(error)}
        </span>
      ) : null}
    </div>
  );
}
