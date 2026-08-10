import type {
  ElementStyle,
  Gradient,
  GradientStop,
} from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import {
  getControlName,
  parseOptionalNumber,
  readPickerColor,
} from "../inspector-helpers";

import type { UpdateElementStyle } from "../inspector-types";

interface ElementBackgroundGradientControlProps {
  style: ElementStyle | undefined;

  onUpdateStyle: UpdateElementStyle;

  controlPrefix: string;
}

const MIN_GRADIENT_STOPS = 2;

const MAX_GRADIENT_STOPS = 8;

const MIN_STOP_POSITION = 0;

const MAX_STOP_POSITION = 100;

const MIN_GRADIENT_ANGLE = -360;

const MAX_GRADIENT_ANGLE = 360;

const DEFAULT_LINEAR_ANGLE = 135;

const DEFAULT_RADIAL_SHAPE = "circle";

const DEFAULT_GRADIENT_STOPS: readonly GradientStop[] = [
  {
    color: "#7c3aed",

    position: MIN_STOP_POSITION,
  },
  {
    color: "#06b6d4",

    position: MAX_STOP_POSITION,
  },
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function isGradientType(value: string): value is Gradient["type"] {
  return value === "linear" || value === "radial";
}

function isRadialShape(
  value: string,
): value is NonNullable<Extract<Gradient, { type: "radial" }>["shape"]> {
  return value === "circle" || value === "ellipse";
}

function createDefaultStops(): GradientStop[] {
  return DEFAULT_GRADIENT_STOPS.map((stop) => ({ ...stop }));
}

function createDefaultGradient(type: Gradient["type"]): Gradient {
  if (type === "linear") {
    return {
      type,

      angle: DEFAULT_LINEAR_ANGLE,

      stops: createDefaultStops(),
    };
  }

  return {
    type,

    shape: DEFAULT_RADIAL_SHAPE,

    stops: createDefaultStops(),
  };
}

function replaceStops(gradient: Gradient, stops: GradientStop[]): Gradient {
  if (gradient.type === "linear") {
    return {
      ...gradient,

      stops,
    };
  }

  return {
    ...gradient,

    stops,
  };
}

function addStop(gradient: Gradient): Gradient {
  if (gradient.stops.length >= MAX_GRADIENT_STOPS) {
    return gradient;
  }

  const firstStop = gradient.stops[0];

  const secondStop = gradient.stops[1];

  if (firstStop === undefined || secondStop === undefined) {
    return gradient;
  }

  let insertionIndex = 1;

  let leftStop = firstStop;

  let rightStop = secondStop;

  let largestGap = rightStop.position - leftStop.position;

  for (let index = 2; index < gradient.stops.length; index += 1) {
    const candidateLeft = gradient.stops[index - 1];

    const candidateRight = gradient.stops[index];

    if (candidateLeft === undefined || candidateRight === undefined) {
      continue;
    }

    const candidateGap = candidateRight.position - candidateLeft.position;

    if (candidateGap > largestGap) {
      insertionIndex = index;

      leftStop = candidateLeft;

      rightStop = candidateRight;

      largestGap = candidateGap;
    }
  }

  const newStop: GradientStop = {
    color: leftStop.color,

    position: (leftStop.position + rightStop.position) / 2,
  };

  return replaceStops(gradient, [
    ...gradient.stops.slice(0, insertionIndex),

    newStop,

    ...gradient.stops.slice(insertionIndex),
  ]);
}

// ============================================================
// BEGIN: ELEMENT BACKGROUND GRADIENT CONTROL
// ============================================================

export function ElementBackgroundGradientControl({
  style,
  onUpdateStyle,
  controlPrefix,
}: ElementBackgroundGradientControlProps) {
  const { t } = useStudioI18n();

  const gradient = style?.backgroundGradient;

  function updateGradient(update: (currentGradient: Gradient) => Gradient) {
    onUpdateStyle((currentStyle) => {
      const currentGradient = currentStyle?.backgroundGradient ?? gradient;

      if (currentGradient === undefined) {
        return { ...currentStyle };
      }

      return {
        ...currentStyle,

        backgroundGradient: update(currentGradient),
      };
    });
  }

  function updateStop(
    index: number,
    update: (currentStop: GradientStop) => GradientStop,
  ) {
    updateGradient((currentGradient) =>
      replaceStops(
        currentGradient,
        currentGradient.stops.map((currentStop, currentIndex) =>
          currentIndex === index ? update(currentStop) : currentStop,
        ),
      ),
    );
  }

  return (
    <div className={styles.gradientControl}>
      <label className={styles.field}>
        <span title={t("inspector.gradientHelp")}>
          {t("inspector.gradient")}
        </span>

        <select
          id={`${controlPrefix}-gradient-type`}
          name={getControlName(controlPrefix, "GradientType")}
          value={gradient?.type ?? "none"}
          onChange={(event) => {
            const gradientMode = event.target.value;

            if (gradientMode === "none") {
              onUpdateStyle((currentStyle) => ({
                ...currentStyle,

                backgroundGradient: undefined,
              }));

              return;
            }

            if (!isGradientType(gradientMode)) {
              return;
            }

            onUpdateStyle((currentStyle) => {
              const currentGradient = currentStyle?.backgroundGradient;

              if (currentGradient === undefined) {
                return {
                  ...currentStyle,

                  backgroundGradient: createDefaultGradient(gradientMode),
                };
              }

              if (currentGradient.type === gradientMode) {
                return { ...currentStyle };
              }

              return {
                ...currentStyle,

                backgroundGradient:
                  gradientMode === "linear"
                    ? {
                        type: "linear",

                        angle: DEFAULT_LINEAR_ANGLE,

                        stops: currentGradient.stops,
                      }
                    : {
                        type: "radial",

                        shape: DEFAULT_RADIAL_SHAPE,

                        stops: currentGradient.stops,
                      },
              };
            });
          }}
        >
          <option value="none">{t("inspector.gradient.none")}</option>

          <option value="linear">{t("inspector.gradient.linear")}</option>

          <option value="radial">{t("inspector.gradient.radial")}</option>
        </select>
      </label>

      {gradient?.type === "linear" && (
        <label className={styles.field}>
          <span>{t("inspector.gradientAngle")}</span>

          <div className={styles.unitInput}>
            <input
              id={`${controlPrefix}-gradient-angle`}
              name={getControlName(controlPrefix, "GradientAngle")}
              type="number"
              min={MIN_GRADIENT_ANGLE}
              max={MAX_GRADIENT_ANGLE}
              value={gradient.angle ?? ""}
              onChange={(event) => {
                const parsedAngle = parseOptionalNumber(event.target.value);

                const angle =
                  parsedAngle === undefined
                    ? undefined
                    : clamp(
                        parsedAngle,
                        MIN_GRADIENT_ANGLE,
                        MAX_GRADIENT_ANGLE,
                      );

                updateGradient((currentGradient) =>
                  currentGradient.type === "linear"
                    ? {
                        type: "linear",

                        stops: currentGradient.stops,

                        ...(angle === undefined ? {} : { angle }),
                      }
                    : currentGradient,
                );
              }}
            />

            <span>°</span>
          </div>
        </label>
      )}

      {gradient?.type === "radial" && (
        <label className={styles.field}>
          <span>{t("inspector.gradientShape")}</span>

          <select
            id={`${controlPrefix}-gradient-shape`}
            name={getControlName(controlPrefix, "GradientShape")}
            value={gradient.shape ?? "ellipse"}
            onChange={(event) => {
              const shape = event.target.value;

              if (!isRadialShape(shape)) {
                return;
              }

              updateGradient((currentGradient) =>
                currentGradient.type === "radial"
                  ? {
                      ...currentGradient,

                      shape,
                    }
                  : currentGradient,
              );
            }}
          >
            <option value="circle">
              {t("inspector.gradientShape.circle")}
            </option>

            <option value="ellipse">
              {t("inspector.gradientShape.ellipse")}
            </option>
          </select>
        </label>
      )}

      {gradient !== undefined && (
        <div className={styles.gradientStops}>
          <span className={styles.gradientStopsTitle}>
            {t("inspector.gradientStops")}
          </span>

          {gradient.stops.map((stop, index) => {
            const previousStop = gradient.stops[index - 1];

            const nextStop = gradient.stops[index + 1];

            const minimumPosition =
              previousStop?.position ?? MIN_STOP_POSITION;

            const maximumPosition = nextStop?.position ?? MAX_STOP_POSITION;

            return (
              <div className={styles.gradientStopRow} key={index}>
                <label className={styles.field}>
                  <span>{t("inspector.gradientStopColor")}</span>

                  <input
                    id={`${controlPrefix}-gradient-stop-${index}-color`}
                    name={getControlName(
                      controlPrefix,
                      `GradientStop${index}Color`,
                    )}
                    className={styles.colorInput}
                    type="color"
                    value={readPickerColor(stop.color)}
                    onChange={(event) => {
                      const color = event.target.value;

                      updateStop(index, (currentStop) => ({
                        ...currentStop,

                        color,
                      }));
                    }}
                  />
                </label>

                <label className={styles.field}>
                  <span>{t("inspector.gradientStopPosition")}</span>

                  <div className={styles.unitInput}>
                    <input
                      id={`${controlPrefix}-gradient-stop-${index}-position`}
                      name={getControlName(
                        controlPrefix,
                        `GradientStop${index}Position`,
                      )}
                      type="number"
                      min={minimumPosition}
                      max={maximumPosition}
                      value={stop.position}
                      onChange={(event) => {
                        const parsedPosition = parseOptionalNumber(
                          event.target.value,
                        );

                        if (parsedPosition === undefined) {
                          return;
                        }

                        const position = clamp(
                          parsedPosition,
                          minimumPosition,
                          maximumPosition,
                        );

                        updateStop(index, (currentStop) => ({
                          ...currentStop,

                          position,
                        }));
                      }}
                    />

                    <span>%</span>
                  </div>
                </label>

                <button
                  className={styles.secondaryButton}
                  type="button"
                  disabled={gradient.stops.length <= MIN_GRADIENT_STOPS}
                  onClick={() => {
                    updateGradient((currentGradient) => {
                      if (
                        currentGradient.stops.length <= MIN_GRADIENT_STOPS
                      ) {
                        return currentGradient;
                      }

                      return replaceStops(
                        currentGradient,
                        currentGradient.stops.filter(
                          (_currentStop, currentIndex) =>
                            currentIndex !== index,
                        ),
                      );
                    });
                  }}
                >
                  <span>{t("inspector.gradientRemoveStop")}</span>
                </button>
              </div>
            );
          })}

          <button
            className={styles.secondaryButton}
            type="button"
            disabled={gradient.stops.length >= MAX_GRADIENT_STOPS}
            onClick={() => {
              updateGradient(addStop);
            }}
          >
            <span>{t("inspector.gradientAddStop")}</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// END: ELEMENT BACKGROUND GRADIENT CONTROL
// ============================================================
