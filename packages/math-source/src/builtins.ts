export type MathBuiltInFunctionName = "sin" | "cos" | "tan" | "sqrt" | "abs" | "log" | "exp";

const builtInFunctionNames: ReadonlySet<string> = new Set<MathBuiltInFunctionName>([
  "sin",
  "cos",
  "tan",
  "sqrt",
  "abs",
  "log",
  "exp",
]);

export function isMathBuiltInFunctionName(name: string): name is MathBuiltInFunctionName {
  return builtInFunctionNames.has(name);
}

export function evaluateMathBuiltIn(name: MathBuiltInFunctionName, argument: number): number {
  switch (name) {
    case "sin": return Math.sin(argument);
    case "cos": return Math.cos(argument);
    case "tan": return Math.tan(argument);
    case "sqrt": return Math.sqrt(argument);
    case "abs": return Math.abs(argument);
    case "log": return Math.log(argument);
    case "exp": return Math.exp(argument);
  }
}
