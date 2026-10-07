import {
  normalizeColor,
  ShapePathGeometrySchema,
  ShapePathCommandSchema,
  type ElementEffect,
  type ShapePathCommand,
  type ShapeVisualStyle,
  type ShapeViewBox,
} from "@web-slideshow/document-schema";

export class SvgPathAuthoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SvgPathAuthoringError";
  }
}

export interface ParsedSvgPathAuthoringSource {
  kind: "path" | "svg";
  commands: ShapePathCommand[];
  viewBox?: ShapeViewBox;
  fillRule?: "nonzero" | "evenodd";
  layers?: SvgImportLayer[];
}

export function classifySvgPathAuthoringSource(source: string): "path" | "svg" {
  return source.trimStart().startsWith("<") ? "svg" : "path";
}

export interface SvgImportLayer {
  geometry: {
    mode: "path";
    viewBox: ShapeViewBox;
    commands: ShapePathCommand[];
    fillRule?: "nonzero" | "evenodd";
  };
  style?: ShapeVisualStyle;
  effect?: ElementEffect;
}

type SvgPathToken =
  | { kind: "command"; value: string }
  | { kind: "number"; value: number };

const COMMANDS = new Set(["M", "m", "L", "l", "H", "h", "V", "v", "C", "c", "S", "s", "Q", "q", "T", "t", "A", "a", "Z", "z"]);
const NUMBER_PATTERN = /^[+-]?(?:(?:\d+\.\d*)|(?:\.\d+)|(?:\d+))(?:[eE][+-]?\d+)?/;

function tokenize(source: string): SvgPathToken[] {
  const tokens: SvgPathToken[] = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index]!;
    if (/\s|,/.test(character)) {
      index += 1;
      continue;
    }

    if (character === "<" || character === ">") {
      throw new SvgPathAuthoringError("SVG path data accepts only the d value, not complete SVG/XML markup.");
    }

    if (/[A-Za-z]/.test(character)) {
      if (!COMMANDS.has(character)) {
        throw new SvgPathAuthoringError(`Unsupported SVG path command \"${character}\".`);
      }
      tokens.push({ kind: "command", value: character });
      index += 1;
      continue;
    }

    const numberMatch = source.slice(index).match(NUMBER_PATTERN);
    if (numberMatch === null) {
      throw new SvgPathAuthoringError(`Unexpected SVG path data at character ${index + 1}.`);
    }

    const value = Number(numberMatch[0]);
    if (!Number.isFinite(value)) {
      throw new SvgPathAuthoringError("SVG path numbers must be finite.");
    }
    tokens.push({ kind: "number", value });
    index += numberMatch[0].length;
  }

  return tokens;
}

function relativeValue(relative: boolean, value: number, current: number): number {
  return relative ? current + value : value;
}

function reflectControl(current: number, previous: number | undefined): number {
  return previous === undefined ? current : 2 * current - previous;
}

function requireNumberGroup(
  tokens: SvgPathToken[],
  index: number,
  count: number,
  command: string,
): number[] {
  if (index + count > tokens.length || tokens.slice(index, index + count).some((token) => token.kind !== "number")) {
    throw new SvgPathAuthoringError(`Command ${command} requires ${count} numeric values.`);
  }
  return tokens.slice(index, index + count).map((token) => {
    if (token.kind !== "number") throw new SvgPathAuthoringError("Expected a number.");
    return token.value;
  });
}

function ensureArcFlag(value: number, name: string): boolean {
  if (value !== 0 && value !== 1) {
    throw new SvgPathAuthoringError(`${name} must be exactly 0 or 1.`);
  }
  return value === 1;
}

export function parseSvgPathData(source: string): ShapePathCommand[] {
  const tokens = tokenize(source);
  if (tokens.length === 0) {
    throw new SvgPathAuthoringError("SVG path data is required.");
  }

  const commands: ShapePathCommand[] = [];
  let index = 0;
  let activeCommand: string | undefined;
  let currentX = 0;
  let currentY = 0;
  let subpathStartX = 0;
  let subpathStartY = 0;
  let previousCommand: string | undefined;
  let previousCubicControlX: number | undefined;
  let previousCubicControlY: number | undefined;
  let previousQuadraticControlX: number | undefined;
  let previousQuadraticControlY: number | undefined;

  function clearSmoothControls(): void {
    previousCubicControlX = undefined;
    previousCubicControlY = undefined;
    previousQuadraticControlX = undefined;
    previousQuadraticControlY = undefined;
  }

  while (index < tokens.length) {
    const token = tokens[index];
    if (token?.kind === "command") {
      activeCommand = token.value;
      index += 1;

      if (activeCommand.toUpperCase() === "Z") {
        commands.push({ type: "close" });
        currentX = subpathStartX;
        currentY = subpathStartY;
        previousCommand = "Z";
        clearSmoothControls();
        activeCommand = undefined;
        continue;
      }
    }

    if (activeCommand === undefined) {
      throw new SvgPathAuthoringError("Expected an SVG path command.");
    }

    const relative = activeCommand === activeCommand.toLowerCase();
    const upperCommand = activeCommand.toUpperCase();
    const groupSize = upperCommand === "M" || upperCommand === "L" || upperCommand === "T"
      ? 2
      : upperCommand === "H" || upperCommand === "V"
        ? 1
        : upperCommand === "C"
          ? 6
          : upperCommand === "S" || upperCommand === "Q"
            ? 4
            : upperCommand === "A"
              ? 7
              : 0;

    if (groupSize === 0) {
      throw new SvgPathAuthoringError(`Unsupported SVG path command \"${activeCommand}\".`);
    }

    let consumedGroup = false;
    while (index < tokens.length && tokens[index]?.kind === "number") {
      const values = requireNumberGroup(tokens, index, groupSize, activeCommand);
      index += groupSize;
      consumedGroup = true;

      if (upperCommand === "M") {
        const nextX = relativeValue(relative, values[0]!, currentX);
        const nextY = relativeValue(relative, values[1]!, currentY);
        commands.push({ type: "move", x: nextX, y: nextY });
        currentX = nextX;
        currentY = nextY;
        subpathStartX = nextX;
        subpathStartY = nextY;
        previousCommand = "M";
        clearSmoothControls();
        activeCommand = relative ? "l" : "L";
        break;
      }

      if (upperCommand === "L") {
        const nextX = relativeValue(relative, values[0]!, currentX);
        const nextY = relativeValue(relative, values[1]!, currentY);
        commands.push({ type: "line", x: nextX, y: nextY });
        currentX = nextX;
        currentY = nextY;
        previousCommand = "L";
        clearSmoothControls();
      } else if (upperCommand === "H") {
        currentX = relativeValue(relative, values[0]!, currentX);
        commands.push({ type: "line", x: currentX, y: currentY });
        previousCommand = "H";
        clearSmoothControls();
      } else if (upperCommand === "V") {
        currentY = relativeValue(relative, values[0]!, currentY);
        commands.push({ type: "line", x: currentX, y: currentY });
        previousCommand = "V";
        clearSmoothControls();
      } else if (upperCommand === "C") {
        const control1X = relativeValue(relative, values[0]!, currentX);
        const control1Y = relativeValue(relative, values[1]!, currentY);
        const control2X = relativeValue(relative, values[2]!, currentX);
        const control2Y = relativeValue(relative, values[3]!, currentY);
        const nextX = relativeValue(relative, values[4]!, currentX);
        const nextY = relativeValue(relative, values[5]!, currentY);
        commands.push({ type: "cubic", control1X, control1Y, control2X, control2Y, x: nextX, y: nextY });
        currentX = nextX;
        currentY = nextY;
        previousCubicControlX = control2X;
        previousCubicControlY = control2Y;
        previousQuadraticControlX = undefined;
        previousQuadraticControlY = undefined;
        previousCommand = "C";
      } else if (upperCommand === "S") {
        const control1X = previousCommand === "C" || previousCommand === "S"
          ? reflectControl(currentX, previousCubicControlX)
          : currentX;
        const control1Y = previousCommand === "C" || previousCommand === "S"
          ? reflectControl(currentY, previousCubicControlY)
          : currentY;
        const control2X = relativeValue(relative, values[0]!, currentX);
        const control2Y = relativeValue(relative, values[1]!, currentY);
        const nextX = relativeValue(relative, values[2]!, currentX);
        const nextY = relativeValue(relative, values[3]!, currentY);
        commands.push({ type: "cubic", control1X, control1Y, control2X, control2Y, x: nextX, y: nextY });
        currentX = nextX;
        currentY = nextY;
        previousCubicControlX = control2X;
        previousCubicControlY = control2Y;
        previousQuadraticControlX = undefined;
        previousQuadraticControlY = undefined;
        previousCommand = "S";
      } else if (upperCommand === "Q") {
        const controlX = relativeValue(relative, values[0]!, currentX);
        const controlY = relativeValue(relative, values[1]!, currentY);
        const nextX = relativeValue(relative, values[2]!, currentX);
        const nextY = relativeValue(relative, values[3]!, currentY);
        commands.push({ type: "quadratic", controlX, controlY, x: nextX, y: nextY });
        currentX = nextX;
        currentY = nextY;
        previousQuadraticControlX = controlX;
        previousQuadraticControlY = controlY;
        previousCubicControlX = undefined;
        previousCubicControlY = undefined;
        previousCommand = "Q";
      } else if (upperCommand === "T") {
        const controlX = previousCommand === "Q" || previousCommand === "T"
          ? reflectControl(currentX, previousQuadraticControlX)
          : currentX;
        const controlY = previousCommand === "Q" || previousCommand === "T"
          ? reflectControl(currentY, previousQuadraticControlY)
          : currentY;
        const nextX = relativeValue(relative, values[0]!, currentX);
        const nextY = relativeValue(relative, values[1]!, currentY);
        commands.push({ type: "quadratic", controlX, controlY, x: nextX, y: nextY });
        currentX = nextX;
        currentY = nextY;
        previousQuadraticControlX = controlX;
        previousQuadraticControlY = controlY;
        previousCubicControlX = undefined;
        previousCubicControlY = undefined;
        previousCommand = "T";
      } else if (upperCommand === "A") {
        const radiusX = Math.abs(values[0]!);
        const radiusY = Math.abs(values[1]!);
        const rotationDeg = values[2]!;
        const largeArc = ensureArcFlag(values[3]!, "Arc large-arc flag");
        const sweep = ensureArcFlag(values[4]!, "Arc sweep flag");
        const nextX = relativeValue(relative, values[5]!, currentX);
        const nextY = relativeValue(relative, values[6]!, currentY);
        if (radiusX === 0 || radiusY === 0) {
          commands.push({ type: "line", x: nextX, y: nextY });
        } else {
          commands.push({ type: "arc", radiusX, radiusY, rotationDeg, largeArc, sweep, x: nextX, y: nextY });
        }
        currentX = nextX;
        currentY = nextY;
        previousCommand = "A";
        clearSmoothControls();
      }
    }

    if (!consumedGroup) {
      throw new SvgPathAuthoringError(`Command ${activeCommand} requires numeric values.`);
    }
  }

  if (commands[0]?.type !== "move") {
    throw new SvgPathAuthoringError("SVG path data must begin with Move (M or m).");
  }

  const parsed = ShapePathCommandSchema.array().min(1).safeParse(commands);
  if (!parsed.success) {
    throw new SvgPathAuthoringError("SVG path data could not be normalized into canonical Shape commands.");
  }
  return parsed.data;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) throw new SvgPathAuthoringError("SVG path commands must contain finite numbers.");
  return Object.is(value, -0) ? "0" : String(value);
}

export function serializeSvgPathData(commands: ShapePathCommand[]): string {
  return commands.map((command) => {
    switch (command.type) {
      case "move": return `M ${formatNumber(command.x)} ${formatNumber(command.y)}`;
      case "line": return `L ${formatNumber(command.x)} ${formatNumber(command.y)}`;
      case "quadratic": return `Q ${formatNumber(command.controlX)} ${formatNumber(command.controlY)} ${formatNumber(command.x)} ${formatNumber(command.y)}`;
      case "cubic": return `C ${formatNumber(command.control1X)} ${formatNumber(command.control1Y)} ${formatNumber(command.control2X)} ${formatNumber(command.control2Y)} ${formatNumber(command.x)} ${formatNumber(command.y)}`;
      case "arc": return `A ${formatNumber(command.radiusX)} ${formatNumber(command.radiusY)} ${formatNumber(command.rotationDeg)} ${command.largeArc ? 1 : 0} ${command.sweep ? 1 : 0} ${formatNumber(command.x)} ${formatNumber(command.y)}`;
      case "close": return "Z";
    }
  }).join(" ");
}

const SVG_UNSAFE_ELEMENTS = new Set([
  "script",
  "foreignobject",
  "image",
  "use",
  "iframe",
  "object",
  "embed",
  "audio",
  "video",
  "style",
  "link",
]);

const SVG_SUPPORTED_ELEMENTS = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
]);

function attribute(element: Element, name: string): string | undefined {
  const match = Array.from(element.attributes).find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
  return match?.value;
}

function parseSvgFillRule(value: string | undefined): "nonzero" | "evenodd" | undefined {
  if (value === undefined) return undefined;
  if (value === "nonzero" || value === "evenodd") return value;
  throw new SvgPathAuthoringError(`Unsupported SVG fill-rule "${value}".`);
}

function parseSvgOpacity(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new SvgPathAuthoringError("SVG opacity must be a finite number between 0 and 1.");
  }
  return parsed;
}

const SVG_COLOR_KEYWORDS = new Map([
  ["black", "#000000"],
  ["white", "#ffffff"],
  ["transparent", "rgba(0, 0, 0, 0)"],
]);

function parseSvgPaint(value: string | undefined): string | "none" | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === "none") return "none";
  if (/^(?:url|context-|currentColor)/i.test(trimmed)) {
    throw new SvgPathAuthoringError("SVG paint references and currentColor are not supported.");
  }
  const keyword = SVG_COLOR_KEYWORDS.get(trimmed.toLowerCase());
  if (keyword !== undefined) return keyword;
  const normalized = normalizeColor(trimmed);
  if (normalized === undefined) {
    throw new SvgPathAuthoringError(`SVG paint "${trimmed}" is not a supported HEX or RGBA color.`);
  }
  return normalized;
}

function parseSvgStrokeWidth(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new SvgPathAuthoringError("SVG stroke-width must be a finite non-negative number.");
  }
  return parsed;
}

function validateSvgAttributes(element: Element): void {
  for (const candidate of Array.from(element.attributes)) {
    const name = candidate.name.toLowerCase();
    const value = candidate.value.trim();
    if (name.startsWith("on")) {
      throw new SvgPathAuthoringError("SVG event-handler attributes are not supported.");
    }
    if (name === "href" || name === "xlink:href") {
      throw new SvgPathAuthoringError("External SVG references are not supported.");
    }
    if (name === "style") {
      throw new SvgPathAuthoringError("SVG CSS/style attributes are not supported; Shape Appearance controls the imported geometry.");
    }
    if (/javascript:|url\s*\(/i.test(value)) {
      throw new SvgPathAuthoringError("Executable or external SVG content is not supported.");
    }
    if (name === "fill-opacity" || name === "stroke-opacity") {
      const opacity = parseSvgOpacity(value);
      if (opacity !== undefined && opacity !== 1) {
        throw new SvgPathAuthoringError("SVG fill-opacity and stroke-opacity are not supported; use element opacity instead.");
      }
    }
  }
}

function parseNumericDimension(value: string | undefined, label: string): number | undefined {
  if (value === undefined || !NUMBER_PATTERN.test(value.trim())) return undefined;
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new SvgPathAuthoringError(`${label} must be a finite positive number.`);
  }
  return parsed;
}

type SvgMatrix = readonly [number, number, number, number, number, number];

const IDENTITY_MATRIX: SvgMatrix = [1, 0, 0, 1, 0, 0];

function multiplySvgMatrices(left: SvgMatrix, right: SvgMatrix): SvgMatrix {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

function parseSvgTransform(value: string | undefined): SvgMatrix {
  if (value === undefined || value.trim() === "") return IDENTITY_MATRIX;
  const source = value.trim();
  const transformPattern = /([A-Za-z]+)\s*\(([^)]*)\)/g;
  let cursor = 0;
  let matrix: SvgMatrix = IDENTITY_MATRIX;
  let match: RegExpExecArray | null;

  while ((match = transformPattern.exec(source)) !== null) {
    if (source.slice(cursor, match.index).trim().replace(/[\s,]/g, "") !== "") {
      throw new SvgPathAuthoringError("SVG transform contains unsupported syntax.");
    }
    const name = match[1]!.toLowerCase();
    const values = parseSvgNumberList(match[2]!, -1, `SVG ${name} transform`);
    let next: SvgMatrix;
    if (name === "matrix") {
      if (values.length !== 6) throw new SvgPathAuthoringError("SVG matrix transform must contain exactly 6 numbers.");
      next = values as unknown as SvgMatrix;
    } else if (name === "translate") {
      if (values.length < 1 || values.length > 2) throw new SvgPathAuthoringError("SVG translate transform must contain one or two numbers.");
      next = [1, 0, 0, 1, values[0]!, values[1] ?? 0];
    } else if (name === "scale") {
      if (values.length < 1 || values.length > 2) throw new SvgPathAuthoringError("SVG scale transform must contain one or two numbers.");
      next = [values[0]!, 0, 0, values[1] ?? values[0]!, 0, 0];
    } else if (name === "rotate") {
      if (values.length !== 1 && values.length !== 3) throw new SvgPathAuthoringError("SVG rotate transform must contain one or three numbers.");
      const radians = values[0]! * Math.PI / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const rotation: SvgMatrix = [cos, sin, -sin, cos, 0, 0];
      if (values[1] === undefined) {
        next = rotation;
      } else {
        const cx = values[1]!;
        const cy = values[2]!;
        next = multiplySvgMatrices(
          multiplySvgMatrices([1, 0, 0, 1, cx, cy], rotation),
          [1, 0, 0, 1, -cx, -cy],
        );
      }
    } else if (name === "skewx" || name === "skewy") {
      const tangent = Math.tan(values[0]! * Math.PI / 180);
      next = name === "skewx" ? [1, 0, tangent, 1, 0, 0] : [1, tangent, 0, 1, 0, 0];
    } else {
      throw new SvgPathAuthoringError(`Unsupported SVG transform "${name}".`);
    }
    matrix = multiplySvgMatrices(matrix, next);
    cursor = transformPattern.lastIndex;
  }

  if (cursor === 0 || source.slice(cursor).trim().replace(/[\s,]/g, "") !== "") {
    throw new SvgPathAuthoringError("SVG transform contains unsupported syntax.");
  }
  return matrix;
}

function applySvgMatrix(matrix: SvgMatrix, x: number, y: number): { x: number; y: number } {
  return {
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5],
  };
}

function arcToCubicCommands(
  startX: number,
  startY: number,
  command: Extract<ShapePathCommand, { type: "arc" }>,
): ShapePathCommand[] {
  const endX = command.x;
  const endY = command.y;
  if (startX === endX && startY === endY) return [];
  const angle = command.rotationDeg * Math.PI / 180;
  const cosAngle = Math.cos(angle);
  const sinAngle = Math.sin(angle);
  let radiusX = Math.abs(command.radiusX);
  let radiusY = Math.abs(command.radiusY);
  const dx = (startX - endX) / 2;
  const dy = (startY - endY) / 2;
  const xPrime = cosAngle * dx + sinAngle * dy;
  const yPrime = -sinAngle * dx + cosAngle * dy;
  const radiiScale = xPrime * xPrime / (radiusX * radiusX) + yPrime * yPrime / (radiusY * radiusY);
  if (radiiScale > 1) {
    const scale = Math.sqrt(radiiScale);
    radiusX *= scale;
    radiusY *= scale;
  }
  const radiiTerm = Math.max(0, (radiusX * radiusX * radiusY * radiusY - radiusX * radiusX * yPrime * yPrime - radiusY * radiusY * xPrime * xPrime) /
    (radiusX * radiusX * yPrime * yPrime + radiusY * radiusY * xPrime * xPrime));
  const sign = command.largeArc === command.sweep ? -1 : 1;
  const coefficient = sign * Math.sqrt(radiiTerm);
  const centerPrimeX = coefficient * radiusX * yPrime / radiusY;
  const centerPrimeY = coefficient * -radiusY * xPrime / radiusX;
  const centerX = cosAngle * centerPrimeX - sinAngle * centerPrimeY + (startX + endX) / 2;
  const centerY = sinAngle * centerPrimeX + cosAngle * centerPrimeY + (startY + endY) / 2;
  const vectorAngle = (ux: number, uy: number, vx: number, vy: number): number => {
    const dot = ux * vx + uy * vy;
    const cross = ux * vy - uy * vx;
    return Math.atan2(cross, dot);
  };
  const startAngle = vectorAngle(1, 0, (xPrime - centerPrimeX) / radiusX, (yPrime - centerPrimeY) / radiusY);
  let deltaAngle = vectorAngle(
    (xPrime - centerPrimeX) / radiusX,
    (yPrime - centerPrimeY) / radiusY,
    (-xPrime - centerPrimeX) / radiusX,
    (-yPrime - centerPrimeY) / radiusY,
  );
  if (!command.sweep && deltaAngle > 0) deltaAngle -= 2 * Math.PI;
  if (command.sweep && deltaAngle < 0) deltaAngle += 2 * Math.PI;
  const segments = Math.max(1, Math.ceil(Math.abs(deltaAngle) / (Math.PI / 2)));
  const step = deltaAngle / segments;
  const commands: ShapePathCommand[] = [];
  for (let index = 0; index < segments; index += 1) {
    const theta1 = startAngle + index * step;
    const theta2 = theta1 + step;
    const alpha = 4 / 3 * Math.tan((theta2 - theta1) / 4);
    const p = (theta: number) => ({
      x: centerX + radiusX * ellipseCoordinates.cosAngle(theta, cosAngle, sinAngle),
      y: centerY + radiusY * ellipseCoordinates.sinAngle(theta, cosAngle, sinAngle),
    });
    const unit = (theta: number) => ({
      x: -radiusX * Math.sin(theta),
      y: radiusY * Math.cos(theta),
    });
    const first = p(theta1);
    const second = p(theta2);
    const firstTangent = unit(theta1);
    const secondTangent = unit(theta2);
    commands.push({
      type: "cubic",
      control1X: first.x + alpha * (cosAngle * firstTangent.x - sinAngle * firstTangent.y),
      control1Y: first.y + alpha * (sinAngle * firstTangent.x + cosAngle * firstTangent.y),
      control2X: second.x - alpha * (cosAngle * secondTangent.x - sinAngle * secondTangent.y),
      control2Y: second.y - alpha * (sinAngle * secondTangent.x + cosAngle * secondTangent.y),
      x: second.x,
      y: second.y,
    });
  }
  const last = commands.at(-1);
  if (last?.type === "cubic") {
    last.x = endX;
    last.y = endY;
  }
  return commands;
}

// Kept as methods on Number-like values only to make the ellipse conversion above readable.
const ellipseCoordinates = {
  cosAngle(theta: number, cosAngle: number, sinAngle: number): number {
    return Math.cos(theta) * cosAngle - Math.sin(theta) * sinAngle;
  },
  sinAngle(theta: number, cosAngle: number, sinAngle: number): number {
    return Math.cos(theta) * sinAngle + Math.sin(theta) * cosAngle;
  },
};

function normalizeImportedCommands(commands: ShapePathCommand[], matrix: SvgMatrix): ShapePathCommand[] {
  const normalized: ShapePathCommand[] = [];
  let currentX = 0;
  let currentY = 0;
  let subpathStartX = 0;
  let subpathStartY = 0;
  for (const command of commands) {
    if (command.type === "arc") {
      const expanded = arcToCubicCommands(currentX, currentY, command);
      normalized.push(...expanded);
      currentX = command.x;
      currentY = command.y;
      continue;
    }
    normalized.push(command);
    if (command.type === "move") {
      currentX = command.x;
      currentY = command.y;
      subpathStartX = command.x;
      subpathStartY = command.y;
    } else if (command.type === "line" || command.type === "quadratic" || command.type === "cubic") {
      currentX = command.x;
      currentY = command.y;
    } else if (command.type === "close") {
      currentX = subpathStartX;
      currentY = subpathStartY;
    }
  }
  return normalized.map((command) => {
    if (command.type === "close") return command;
    const end = applySvgMatrix(matrix, command.x, command.y);
    if (command.type === "move" || command.type === "line") return { ...command, ...end };
    if (command.type === "quadratic") {
      const control = applySvgMatrix(matrix, command.controlX, command.controlY);
      return { ...command, ...end, controlX: control.x, controlY: control.y };
    }
    if (command.type === "cubic") {
      const control1 = applySvgMatrix(matrix, command.control1X, command.control1Y);
      const control2 = applySvgMatrix(matrix, command.control2X, command.control2Y);
      return { ...command, ...end, control1X: control1.x, control1Y: control1.y, control2X: control2.x, control2Y: control2.y };
    }
    return command;
  });
}

function parseSvgPoints(value: string | undefined, label: string, minimumPoints: number): Array<{ x: number; y: number }> {
  if (value === undefined) throw new SvgPathAuthoringError(`${label} requires points.`);
  const numbers = parseSvgNumberList(value, -1, label);
  if (numbers.length < minimumPoints * 2 || numbers.length % 2 !== 0) {
    throw new SvgPathAuthoringError(`${label} must contain coordinate pairs.`);
  }
  const points: Array<{ x: number; y: number }> = [];
  for (let index = 0; index < numbers.length; index += 2) points.push({ x: numbers[index]!, y: numbers[index + 1]! });
  return points;
}

function parseSvgNumberList(value: string, expectedCount: number, label: string): number[] {
  const tokens = tokenize(value);
  if ((expectedCount >= 0 && tokens.length !== expectedCount) || tokens.some((token) => token.kind !== "number")) {
    throw new SvgPathAuthoringError(`${label} must contain ${expectedCount >= 0 ? `exactly ${expectedCount}` : "only"} finite numbers.`);
  }
  return tokens.map((token) => {
    if (token.kind !== "number") throw new SvgPathAuthoringError(`${label} must contain only numbers.`);
    return token.value;
  });
}

function elementNumber(element: Element, name: string, fallback = 0): number {
  const value = attribute(element, name);
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) throw new SvgPathAuthoringError(`SVG ${name} must be finite.`);
  return parsed;
}

function primitiveCommands(element: Element): ShapePathCommand[] {
  const tagName = element.localName.toLowerCase();
  if (tagName === "path") {
    const value = attribute(element, "d");
    if (value === undefined || value.trim() === "") throw new SvgPathAuthoringError("Every imported SVG <path> must contain non-empty d path data.");
    return parseSvgPathData(value);
  }
  if (tagName === "line") {
    return [
      { type: "move", x: elementNumber(element, "x1"), y: elementNumber(element, "y1") },
      { type: "line", x: elementNumber(element, "x2"), y: elementNumber(element, "y2") },
    ];
  }
  if (tagName === "polyline" || tagName === "polygon") {
    const points = parseSvgPoints(attribute(element, "points"), `<${tagName}>`, tagName === "polygon" ? 3 : 2);
    const commands: ShapePathCommand[] = [{ type: "move", x: points[0]!.x, y: points[0]!.y }];
    commands.push(...points.slice(1).map((point) => ({ type: "line" as const, x: point.x, y: point.y })));
    if (tagName === "polygon") commands.push({ type: "close" });
    return commands;
  }
  if (tagName === "circle" || tagName === "ellipse") {
    const cx = elementNumber(element, "cx");
    const cy = elementNumber(element, "cy");
    const radiusX = tagName === "circle" ? elementNumber(element, "r") : elementNumber(element, "rx");
    const radiusY = tagName === "circle" ? radiusX : elementNumber(element, "ry");
    if (radiusX <= 0 || radiusY <= 0) throw new SvgPathAuthoringError(`<${tagName}> radii must be greater than zero.`);
    const k = 0.5522847498307936;
    return [
      { type: "move", x: cx + radiusX, y: cy },
      { type: "cubic", control1X: cx + radiusX, control1Y: cy + k * radiusY, control2X: cx + k * radiusX, control2Y: cy + radiusY, x: cx, y: cy + radiusY },
      { type: "cubic", control1X: cx - k * radiusX, control1Y: cy + radiusY, control2X: cx - radiusX, control2Y: cy + k * radiusY, x: cx - radiusX, y: cy },
      { type: "cubic", control1X: cx - radiusX, control1Y: cy - k * radiusY, control2X: cx - k * radiusX, control2Y: cy - radiusY, x: cx, y: cy - radiusY },
      { type: "cubic", control1X: cx + k * radiusX, control1Y: cy - radiusY, control2X: cx + radiusX, control2Y: cy - k * radiusY, x: cx + radiusX, y: cy },
      { type: "close" },
    ];
  }
  if (tagName === "rect") {
    const x = elementNumber(element, "x");
    const y = elementNumber(element, "y");
    const width = elementNumber(element, "width");
    const height = elementNumber(element, "height");
    if (width <= 0 || height <= 0) throw new SvgPathAuthoringError("SVG rect width and height must be greater than zero.");
    let rx = elementNumber(element, "rx");
    let ry = elementNumber(element, "ry");
    if (rx === 0 && ry !== 0) rx = ry;
    if (ry === 0 && rx !== 0) ry = rx;
    rx = Math.min(Math.abs(rx), width / 2);
    ry = Math.min(Math.abs(ry), height / 2);
    if (rx === 0 || ry === 0) {
      return [{ type: "move", x, y }, { type: "line", x: x + width, y }, { type: "line", x: x + width, y: y + height }, { type: "line", x, y: y + height }, { type: "close" }];
    }
    const k = 0.5522847498307936;
    return [
      { type: "move", x: x + rx, y }, { type: "line", x: x + width - rx, y },
      { type: "cubic", control1X: x + width - rx + k * rx, control1Y: y, control2X: x + width, control2Y: y + ry - k * ry, x: x + width, y: y + ry },
      { type: "line", x: x + width, y: y + height - ry },
      { type: "cubic", control1X: x + width, control1Y: y + height - ry + k * ry, control2X: x + width - rx + k * rx, control2Y: y + height, x: x + width - rx, y: y + height },
      { type: "line", x, y: y + height },
      { type: "cubic", control1X: x + rx - k * rx, control1Y: y + height, control2X: x, control2Y: y + height - ry + k * ry, x, y: y + height - ry },
      { type: "line", x, y: y + ry },
      { type: "cubic", control1X: x, control1Y: y + ry - k * ry, control2X: x + rx - k * rx, control2Y: y, x: x + rx, y },
      { type: "close" },
    ];
  }
  throw new SvgPathAuthoringError(`SVG element <${tagName}> is not supported by the safe Shape importer.`);
}

interface SvgInheritedStyle {
  fill: string | "none";
  stroke: string | "none";
  strokeWidth: number;
  fillRule: "nonzero" | "evenodd";
  opacity: number;
}

function resolveSvgStyle(element: Element, inherited: SvgInheritedStyle): SvgInheritedStyle {
  const fill = parseSvgPaint(attribute(element, "fill")) ?? inherited.fill;
  const stroke = parseSvgPaint(attribute(element, "stroke")) ?? inherited.stroke;
  const strokeWidth = parseSvgStrokeWidth(attribute(element, "stroke-width")) ?? inherited.strokeWidth;
  const fillRule = parseSvgFillRule(attribute(element, "fill-rule")) ?? inherited.fillRule;
  const ownOpacity = parseSvgOpacity(attribute(element, "opacity")) ?? 1;
  return { fill, stroke, strokeWidth, fillRule, opacity: inherited.opacity * ownOpacity };
}

function shapeStyleFromSvgStyle(style: SvgInheritedStyle, tagName: string): ShapeVisualStyle | undefined {
  const fill = tagName === "line" || tagName === "polyline" ? "none" : style.fill;
  const next: ShapeVisualStyle = {};
  if (fill !== "none") next.fill = { type: "color", color: fill };
  if (style.stroke !== "none" && style.strokeWidth > 0) {
    next.stroke = { width: style.strokeWidth, style: "solid", color: style.stroke };
  }
  return next.fill === undefined && next.stroke === undefined ? undefined : next;
}

function parseSvgEnvelope(source: string): ParsedSvgPathAuthoringSource {
  if (/<!doctype|<!entity/i.test(source)) {
    throw new SvgPathAuthoringError("SVG DOCTYPE and entity declarations are not supported.");
  }
  if (typeof DOMParser === "undefined") {
    throw new SvgPathAuthoringError("Complete SVG import is unavailable in this environment.");
  }

  const document = new DOMParser().parseFromString(source, "image/svg+xml");
  if (document.querySelector("parsererror")) {
    throw new SvgPathAuthoringError("The SVG envelope is not well-formed XML.");
  }

  const root = document.documentElement;
  if (root === null || root.localName.toLowerCase() !== "svg") {
    throw new SvgPathAuthoringError("Complete SVG source must have an <svg> root element.");
  }

  const viewBoxValue = attribute(root, "viewBox");
  let viewBox: ShapeViewBox | undefined;
  if (viewBoxValue !== undefined) {
    const [x, y, width, height] = parseSvgNumberList(viewBoxValue, 4, "SVG viewBox");
    if (width! <= 0 || height! <= 0) {
      throw new SvgPathAuthoringError("SVG viewBox width and height must be greater than zero.");
    }
    viewBox = { x: x!, y: y!, width: width!, height: height! };
  } else {
    const width = parseNumericDimension(attribute(root, "width"), "SVG width");
    const height = parseNumericDimension(attribute(root, "height"), "SVG height");
    if (width === undefined || height === undefined) {
      throw new SvgPathAuthoringError("SVG envelope requires a valid viewBox or clean numeric width and height.");
    }
    viewBox = { x: 0, y: 0, width, height };
  }

  validateSvgAttributes(root);
  const layers: SvgImportLayer[] = [];

  function visit(element: Element, inherited: SvgInheritedStyle, inheritedMatrix: SvgMatrix): void {
    const tagName = element.localName.toLowerCase();
    if (SVG_UNSAFE_ELEMENTS.has(tagName)) {
      throw new SvgPathAuthoringError(`SVG element <${tagName}> is not supported.`);
    }
    if (!SVG_SUPPORTED_ELEMENTS.has(tagName) || (tagName === "svg" && element !== root)) {
      throw new SvgPathAuthoringError(`SVG element <${tagName}> is not supported by the safe Shape importer.`);
    }
    validateSvgAttributes(element);
    const style = resolveSvgStyle(element, inherited);
    const matrix = multiplySvgMatrices(inheritedMatrix, parseSvgTransform(attribute(element, "transform")));
    if (tagName !== "svg" && tagName !== "g") {
      const commands = normalizeImportedCommands(primitiveCommands(element), matrix);
      const geometry = {
        mode: "path" as const,
        viewBox,
        commands,
        ...(style.fillRule === "evenodd" ? { fillRule: "evenodd" as const } : {}),
      };
      const parsedGeometry = ShapePathGeometrySchema.safeParse(geometry);
      if (!parsedGeometry.success) throw new SvgPathAuthoringError("Imported SVG geometry could not be normalized into canonical Shape commands.");
      const effect = style.opacity === 1 ? undefined : { opacity: style.opacity };
      layers.push({ geometry: parsedGeometry.data, style: shapeStyleFromSvgStyle(style, tagName), effect });
    }

    for (const child of Array.from(element.childNodes)) {
      if ((child.nodeType === 3 || child.nodeType === 4) && child.textContent?.trim() !== "") {
        throw new SvgPathAuthoringError("SVG text content is not supported by the safe Shape importer.");
      }
    }

    for (const child of Array.from(element.children)) visit(child, style, matrix);
  }

  visit(root, { fill: "#000000", stroke: "none", strokeWidth: 1, fillRule: "nonzero", opacity: 1 }, IDENTITY_MATRIX);
  if (layers.length === 0) throw new SvgPathAuthoringError("SVG envelope must contain at least one supported primitive.");
  const fillRules = new Set(layers.map((layer) => layer.geometry.fillRule ?? "nonzero"));
  const fillRule = fillRules.size === 1 ? [...fillRules][0] : undefined;
  return {
    kind: "svg",
    commands: layers.flatMap((layer) => layer.geometry.commands),
    viewBox,
    layers,
    ...(fillRule === undefined || fillRule === "nonzero" ? {} : { fillRule }),
  };
}

export function parseSvgPathAuthoringSource(source: string): ParsedSvgPathAuthoringSource {
  return source.trimStart().startsWith("<")
    ? parseSvgEnvelope(source)
    : { kind: "path", commands: parseSvgPathData(source) };
}
