export function shouldIgnoreCanvasBackgroundClick(
  capturedElementId: string | null,
): boolean {
  return capturedElementId !== null;
}
