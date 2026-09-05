import { parseMathSource, type MathEquationStatement, type MathExpression, type MathProgram, type MathSourceDiagnostic } from "./parser";
import { isMathBuiltInFunctionName } from "./builtins";

export type MathCoordinateName = "x" | "y" | "z";

export type MathEquationForm =
  | "explicit-y"
  | "explicit-x"
  | "explicit-z"
  | "implicit-2d"
  | "implicit-3d";

export type MathSemanticDiagnosticCode = "unknown-function" | "equation-has-no-coordinate";

export interface MathSemanticDiagnostic {
  code: MathSemanticDiagnosticCode;
  message: string;
  start: number;
  end: number;
}

export interface MathSemanticEquation {
  kind: "equation";
  form: MathEquationForm;
  equation: MathEquationStatement;
  coordinates: MathCoordinateName[];
  parameters: string[];
  start: number;
  end: number;
}

export interface MathAnalysisResult {
  program: MathProgram;
  equations: MathSemanticEquation[];
  diagnostics: Array<MathSourceDiagnostic | MathSemanticDiagnostic>;
}

const coordinates = new Set<MathCoordinateName>(["x", "y", "z"]);
const constants = new Set(["pi", "e"]);

interface ExpressionSummary {
  coordinates: MathCoordinateName[];
  parameters: string[];
  references: Set<string>;
  unknownFunctions: MathSemanticDiagnostic[];
}

function summarizeExpression(expression: MathExpression): ExpressionSummary {
  const summary: ExpressionSummary = {
    coordinates: [],
    parameters: [],
    references: new Set(),
    unknownFunctions: [],
  };

  const visit = (node: MathExpression): void => {
    if (node.kind === "identifier") {
      summary.references.add(node.name);
      if (coordinates.has(node.name as MathCoordinateName)) {
        const coordinate = node.name as MathCoordinateName;
        if (!summary.coordinates.includes(coordinate)) summary.coordinates.push(coordinate);
      } else if (!constants.has(node.name) && !summary.parameters.includes(node.name)) {
        summary.parameters.push(node.name);
      }
      return;
    }
    if (node.kind === "call") {
      if (!isMathBuiltInFunctionName(node.callee)) {
        summary.unknownFunctions.push({
          code: "unknown-function",
          message: `Unknown function '${node.callee}'.`,
          start: node.start,
          end: node.start + node.callee.length,
        });
      }
      visit(node.argument);
      return;
    }
    if (node.kind === "group") {
      visit(node.expression);
      return;
    }
    if (node.kind === "unary") {
      visit(node.operand);
      return;
    }
    if (node.kind === "binary") {
      visit(node.left);
      visit(node.right);
    }
  };

  visit(expression);
  return summary;
}

function mergeSummaries(left: ExpressionSummary, right: ExpressionSummary): ExpressionSummary {
  const summary: ExpressionSummary = {
    coordinates: [...left.coordinates],
    parameters: [...left.parameters],
    references: new Set([...left.references, ...right.references]),
    unknownFunctions: [...left.unknownFunctions],
  };
  for (const coordinate of right.coordinates) {
    if (!summary.coordinates.includes(coordinate)) summary.coordinates.push(coordinate);
  }
  for (const parameter of right.parameters) {
    if (!summary.parameters.includes(parameter)) summary.parameters.push(parameter);
  }
  summary.unknownFunctions.push(...right.unknownFunctions);
  return summary;
}

function classify(equation: MathEquationStatement, summary: ExpressionSummary, right: ExpressionSummary): MathEquationForm {
  const leftName = equation.left.kind === "identifier" ? equation.left.name : undefined;
  if (leftName === "y" && !right.references.has("y") && !right.references.has("z")) return "explicit-y";
  if (leftName === "x" && !right.references.has("x") && !right.references.has("z")) return "explicit-x";
  if (leftName === "z" && !right.references.has("z")) return "explicit-z";
  return summary.references.has("z") ? "implicit-3d" : "implicit-2d";
}

function analyzeEquation(equation: MathEquationStatement): {
  semantic: MathSemanticEquation | null;
  diagnostics: MathSemanticDiagnostic[];
} {
  const left = summarizeExpression(equation.left);
  const right = summarizeExpression(equation.right);
  const summary = mergeSummaries(left, right);
  const diagnostics = [...summary.unknownFunctions];
  if (summary.coordinates.length === 0) {
    diagnostics.push({
      code: "equation-has-no-coordinate",
      message: "Equation has no coordinate.",
      start: equation.start,
      end: equation.end,
    });
  }
  if (diagnostics.length > 0) return { semantic: null, diagnostics };
  return {
    semantic: {
      kind: "equation",
      form: classify(equation, summary, right),
      equation,
      coordinates: summary.coordinates,
      parameters: summary.parameters,
      start: equation.start,
      end: equation.end,
    },
    diagnostics,
  };
}

export function analyzeMathSource(source: string): MathAnalysisResult {
  const parsed = parseMathSource(source);
  const equations: MathSemanticEquation[] = [];
  const semanticDiagnostics: MathSemanticDiagnostic[] = [];
  for (const equation of parsed.program.statements) {
    const result = analyzeEquation(equation);
    if (result.semantic !== null) equations.push(result.semantic);
    semanticDiagnostics.push(...result.diagnostics);
  }
  const diagnostics = [...parsed.diagnostics, ...semanticDiagnostics].map((diagnostic, index) => ({ diagnostic, index }));
  diagnostics.sort((a, b) => a.diagnostic.start - b.diagnostic.start || a.diagnostic.end - b.diagnostic.end || a.index - b.index);
  return {
    program: parsed.program,
    equations,
    diagnostics: diagnostics.map(({ diagnostic }) => diagnostic),
  };
}
