import type {
  ResolvedWebFontFamily,
} from "./web-font-types";

export interface WebFontFaceSelection {
  weight: number;
  style: "normal" | "italic";
  subset: string;
}

function distinct<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function pickNearestWeight(weights: readonly number[]): number {
  if (weights.includes(400)) {
    return 400;
  }

  let best = weights[0];

  for (const candidate of weights) {
    if (best === undefined) {
      best = candidate;
      continue;
    }

    const bestDistance = Math.abs(best - 400);
    const candidateDistance = Math.abs(candidate - 400);

    if (
      candidateDistance < bestDistance ||
      (candidateDistance === bestDistance && candidate < best)
    ) {
      best = candidate;
    }
  }

  if (best === undefined) {
    throw new Error("pickNearestWeight requires at least one weight");
  }

  return best;
}

function sortSubsets(subsetValues: readonly string[]): string[] {
  // Deterministic ordering independent of the runtime locale: plain lexical
  // code-unit comparison, never localeCompare.
  return [...subsetValues].sort((first, second) => {
    if (first < second) {
      return -1;
    }

    if (first > second) {
      return 1;
    }

    return 0;
  });
}

function chooseSubset(
  variantFaces: ResolvedWebFontFamily["faces"],
  defaultSubset: string | undefined,
  preferredSubset: string | undefined,
): string {
  const subsetValues = distinct(
    variantFaces.map((face) => face.subset ?? ""),
  );
  const orderedSubsets = sortSubsets(subsetValues);

  if (
    preferredSubset !== undefined &&
    orderedSubsets.includes(preferredSubset)
  ) {
    return preferredSubset;
  }

  if (
    defaultSubset !== undefined &&
    orderedSubsets.includes(defaultSubset)
  ) {
    return defaultSubset;
  }

  if (orderedSubsets.includes("latin")) {
    return "latin";
  }

  return orderedSubsets[0] ?? "";
}

export function chooseRecommendedFontFace(
  family: ResolvedWebFontFamily,
  preferred: Partial<WebFontFaceSelection> = {},
): WebFontFaceSelection | undefined {
  if (family.faces.length === 0) {
    return undefined;
  }

  const familyWeights = distinct(family.faces.map((face) => face.weight));
  const preferredWeight =
    preferred.weight !== undefined &&
    familyWeights.includes(preferred.weight)
      ? preferred.weight
      : undefined;

  let weight: number;
  let style: "normal" | "italic";

  if (preferredWeight !== undefined) {
    // The weight was decided (for example by the Customize weight select):
    // stay on the provided style when it exists at that weight, otherwise
    // prefer normal at that weight, falling back deterministically.
    weight = preferredWeight;
    const weightStyles = distinct(
      family.faces
        .filter((face) => face.weight === weight)
        .map((face) => face.style),
    );
    const preferredStyleValid =
      preferred.style !== undefined &&
      weightStyles.includes(preferred.style);
    const preferredStyleAtWeight = preferredStyleValid
      ? preferred.style
      : undefined;

    style =
      preferredStyleAtWeight ??
      (weightStyles.includes("normal") ? "normal" : (weightStyles[0] ?? "normal"));
  } else {
    // Recommended face: prefer the preferred style when it exists
    // anywhere in the family; otherwise normal beats italic.
    const familyStyles = distinct(family.faces.map((face) => face.style));
    const preferredStyleValid =
      preferred.style !== undefined &&
      familyStyles.includes(preferred.style);
    const preferredStyleAnywhere = preferredStyleValid
      ? preferred.style
      : undefined;

    style =
      preferredStyleAnywhere ??
      (familyStyles.includes("normal") ? "normal" : (familyStyles[0] ?? "normal"));

    const styleWeights = distinct(
      family.faces
        .filter((face) => face.style === style)
        .map((face) => face.weight),
    ).sort((first, second) => first - second);

    if (styleWeights.length === 0) {
      return undefined;
    }

    weight = pickNearestWeight(styleWeights);
  }

  const variantFaces = family.faces.filter(
    (face) => face.weight === weight && face.style === style,
  );

  if (variantFaces.length === 0) {
    return undefined;
  }

  const subset = chooseSubset(
    variantFaces,
    family.defaultSubset,
    preferred.subset,
  );

  return { weight, style, subset };
}