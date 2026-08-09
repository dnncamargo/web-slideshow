import type {
  PowerShowElement,
} from "@powershow/document-schema";

import styles from
  "./editor-workspace.module.css";


// ============================================================
// BEGIN: TIPOS DO IMAGE INSPECTOR
// ============================================================

type ImageElement =
  Extract<
    PowerShowElement,
    {
      type: "image";
    }
  >;


interface ImageInspectorProps {
  element: ImageElement;

  onUpdate: (
    update: (
      element: PowerShowElement,
    ) => PowerShowElement,
  ) => void;
}

// ============================================================
// END: TIPOS DO IMAGE INSPECTOR
// ============================================================


// ============================================================
// BEGIN: IMAGE INSPECTOR
// ============================================================

export function ImageInspector({
  element,
  onUpdate,
}: ImageInspectorProps) {
  return (
    <>
      <div
        className={
          styles.inspectorDivider
        }
      />


      <div
        className={
          styles.inspectorSectionTitle
        }
      >
        Image
      </div>


      {/* =====================================================
          BEGIN: SOURCE
          ===================================================== */}

      <label
        className={
          styles.field
        }
      >
        <span>
          Source
        </span>

        <textarea
          className={
            styles.textArea
          }

          rows={3}

          spellCheck={false}

          value={
            element.src
          }

          onChange={
            (event) => {
              const src =
                event.target.value;


              onUpdate(
                (current) => {
                  if (
                    current.type !==
                    "image"
                  ) {
                    return current;
                  }


                  return {
                    ...current,

                    src,
                  };
                },
              );
            }
          }
        />

        <small
          className={
            styles.fieldHint
          }
        >
          Image path or source.
        </small>
      </label>

      {/* =====================================================
          END: SOURCE
          ===================================================== */}


      {/* =====================================================
          BEGIN: ALT TEXT
          ===================================================== */}

      <label
        className={
          styles.field
        }
      >
        <span>
          Alternative text
        </span>

        <textarea
          className={
            styles.textArea
          }

          rows={3}

          value={
            element.alt
          }

          onChange={
            (event) => {
              const alt =
                event.target.value;


              onUpdate(
                (current) => {
                  if (
                    current.type !==
                    "image"
                  ) {
                    return current;
                  }


                  return {
                    ...current,

                    alt,
                  };
                },
              );
            }
          }
        />
      </label>

      {/* =====================================================
          END: ALT TEXT
          ===================================================== */}


      {/* =====================================================
          BEGIN: FIT
          ===================================================== */}

      <label
        className={
          styles.field
        }
      >
        <span>
          Fit
        </span>

        <select
          value={
            element.fit
          }

          onChange={
            (event) => {
              const fit =
                event.target.value as
                  ImageElement["fit"];


              onUpdate(
                (current) => {
                  if (
                    current.type !==
                    "image"
                  ) {
                    return current;
                  }


                  return {
                    ...current,

                    fit,
                  };
                },
              );
            }
          }
        >
          <option
            value="contain"
          >
            Contain
          </option>

          <option
            value="cover"
          >
            Cover
          </option>

          <option
            value="fill"
          >
            Fill
          </option>
        </select>
      </label>

      {/* =====================================================
          END: FIT
          ===================================================== */}
    </>
  );
}

// ============================================================
// END: IMAGE INSPECTOR
// ============================================================