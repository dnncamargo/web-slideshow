import type { MathExpression } from "./parser";
import { evaluateMathBuiltIn, isMathBuiltInFunctionName, type MathBuiltInFunctionName } from "./builtins";
import type { MathSemanticEquation } from "./semantic";

export type MathBindings = Readonly<Record<string, number>>;

export type MathEvaluationDiagnosticCode =
  | "missing-binding"
  | "invalid-binding"
  | "division-by-zero"
  | "invalid-domain"
  | "non-finite-result"
  | "evaluation-budget-exceeded";

export interface MathEvaluationDiagnostic {
  code: MathEvaluationDiagnosticCode;
  message: string;
  start: number;
  end: number;
}

export interface MathEvaluationResult {
  value: number | null;
  diagnostics: MathEvaluationDiagnostic[];
}

const MAX_EVALUATION_STEPS = 2048;

class EvaluationFailure extends Error {
  public constructor(public readonly diagnostic: MathEvaluationDiagnostic) {
    super(diagnostic.message);
  }
}

class EvaluationContext {
  private steps = 0;

  public constructor(private readonly bindings: MathBindings) {}

  public evaluate(node: MathExpression): number {
    if (this.steps >= MAX_EVALUATION_STEPS) {
      throw new EvaluationFailure(this.diagnostic("evaluation-budget-exceeded", "Evaluation budget exceeded.", node));
    }
    this.steps += 1;

    switch (node.kind) {
      case "number": {
        const value = Number(node.raw);
        return this.finite(value, node);
      }
      case "identifier": {
        if (node.name === "pi") return Math.PI;
        if (node.name === "e") return Math.E;
        if (!Object.prototype.hasOwnProperty.call(this.bindings, node.name)) {
          throw new EvaluationFailure(this.diagnostic("missing-binding", `Missing binding for '${node.name}'.`, node));
        }
        const value = this.bindings[node.name];
        if (typeof value !== "number" || !Number.isFinite(value)) {
          throw new EvaluationFailure(this.diagnostic("invalid-binding", `Binding for '${node.name}' must be finite.`, node));
        }
        return value;
      }
      case "group":
        return this.evaluate(node.expression);
      case "unary": {
        const operand = this.evaluate(node.operand);
        return this.finite(node.operator === "+" ? operand : -operand, node);
      }
      case "binary": {
        const left = this.evaluate(node.left);
        const right = this.evaluate(node.right);
        if (node.operator === "/" && right === 0) {
          throw new EvaluationFailure(this.diagnostic("division-by-zero", "Division by zero.", node));
        }
        let value: number;
        switch (node.operator) {
          case "+": value = left + right; break;
          case "-": value = left - right; break;
          case "*": value = left * right; break;
          case "/": value = left / right; break;
          case "^": value = left ** right; break;
        }
        return this.finite(value, node);
      }
      case "call": {
        const argument = this.evaluate(node.argument);
        if (node.callee === "sqrt" && argument < 0 || node.callee === "log" && argument <= 0) {
          throw new EvaluationFailure(this.diagnostic("invalid-domain", `Invalid domain for ${node.callee}().`, node));
        }
        if (!isMathBuiltInFunctionName(node.callee)) {
          throw new EvaluationFailure(this.diagnostic("non-finite-result", "Result is not finite.", node));
        }
        return this.finite(evaluateMathBuiltIn(node.callee as MathBuiltInFunctionName, argument), node);
      }
    }
  }

  private finite(value: number, node: MathExpression): number {
    if (!Number.isFinite(value)) {
      throw new EvaluationFailure(this.diagnostic("non-finite-result", "Result is not finite.", node));
    }
    return value;
  }

  private diagnostic(code: MathEvaluationDiagnosticCode, message: string, node: MathExpression): MathEvaluationDiagnostic {
    return { code, message, start: node.start, end: node.end };
  }
}

export function evaluateMathEquation(
  equation: MathSemanticEquation,
  bindings: MathBindings = {},
): MathEvaluationResult {
  const context = new EvaluationContext(bindings);
  try {
    const value = equation.form === "explicit-y" || equation.form === "explicit-x" || equation.form === "explicit-z"
      ? context.evaluate(equation.equation.right)
      : context.evaluate(equation.equation.left) - context.evaluate(equation.equation.right);
    if (!Number.isFinite(value)) {
      return {
        value: null,
        diagnostics: [{ code: "non-finite-result", message: "Result is not finite.", start: equation.start, end: equation.end }],
      };
    }
    return { value, diagnostics: [] };
  } catch (error) {
    if (error instanceof EvaluationFailure) return { value: null, diagnostics: [error.diagnostic] };
    throw error;
  }
}
