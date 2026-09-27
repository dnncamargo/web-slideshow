import {
  ShapePathCommandSchema,
  type ShapePathCommand,
} from "@web-slideshow/document-schema";

export class SvgPathAuthoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SvgPathAuthoringError";
  }
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
