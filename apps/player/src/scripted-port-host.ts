import {
  visitSlideElements,
  type ScriptedElement,
  type Slide,
} from "@powershow/document-schema";

import {
  SCRIPTED_ACTION_MESSAGE_TYPE,
  SCRIPTED_INPUT_MESSAGE_TYPE,
  SCRIPTED_REPORT_MESSAGE_TYPE,
  type ScriptedReportMessage,
} from "@powershow/renderer";

function findScriptedElement(
  slide: Slide | undefined,
  elementId: string,
): ScriptedElement | null {
  if (!slide) {
    return null;
  }

  let result: ScriptedElement | null = null;

  visitSlideElements(slide, (element) => {
    if (element.type === "scripted" && element.id === elementId) {
      result = element;
    }
  });

  return result;
}

function findScriptedFrame(
  slideSurface: HTMLElement,
  elementId: string,
): HTMLIFrameElement | null {
  for (const frame of slideSurface.querySelectorAll<HTMLIFrameElement>(
    'iframe[data-powershow-type="scripted"][data-powershow-id]',
  )) {
    if (frame.dataset.powershowId === elementId) {
      return frame;
    }
  }

  return null;
}

function inputPort(port: ScriptedElement["ports"][number]): boolean {
  return (port.kind === "boolean" || port.kind === "number") &&
    (port.direction === "input" || port.direction === "input-output");
}

function outputPort(port: ScriptedElement["ports"][number]): boolean {
  return (port.kind === "boolean" || port.kind === "number") &&
    (port.direction === "output" || port.direction === "input-output");
}

function validValue(
  port: ScriptedElement["ports"][number],
  value: unknown,
): value is boolean | number {
  if (port.kind === "boolean") {
    return typeof value === "boolean";
  }

  return port.kind === "number" &&
    typeof value === "number" &&
    Number.isFinite(value) &&
    (port.min === undefined || value >= port.min) &&
    (port.max === undefined || value <= port.max);
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value);

  return actualKeys.length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]";
}

export function postScriptedAction(
  slide: Slide | undefined,
  slideSurface: HTMLElement,
  elementId: string,
  portId: string,
): void {
  const element = findScriptedElement(slide, elementId);
  const port = element?.ports.find((candidate) => candidate.id === portId);
  const frame = element && findScriptedFrame(slideSurface, elementId);

  if (!element || !port || port.kind !== "action" || !frame?.contentWindow) {
    return;
  }

  frame.contentWindow.postMessage({
    type: SCRIPTED_ACTION_MESSAGE_TYPE,
    elementId,
    portId,
  }, "*");
}

export function postScriptedInput(
  slide: Slide | undefined,
  slideSurface: HTMLElement,
  elementId: string,
  portId: string,
  value: boolean | number,
): void {
  const element = findScriptedElement(slide, elementId);
  const port = element?.ports.find((candidate) => candidate.id === portId);
  const frame = element && findScriptedFrame(slideSurface, elementId);

  if (!element || !port || !inputPort(port) || !validValue(port, value) || !frame?.contentWindow) {
    return;
  }

  frame.contentWindow.postMessage({
    type: SCRIPTED_INPUT_MESSAGE_TYPE,
    elementId,
    portId,
    value,
  }, "*");
}

export function validateScriptedReport(
  event: MessageEvent<unknown>,
  slide: Slide | undefined,
  slideSurface: HTMLElement,
): ScriptedReportMessage | null {
  if (!plainRecord(event.data) || !exactKeys(event.data, ["type", "elementId", "portId", "value"])) {
    return null;
  }

  const data = event.data;

  if (data.type !== SCRIPTED_REPORT_MESSAGE_TYPE || typeof data.elementId !== "string" || typeof data.portId !== "string") {
    return null;
  }

  const frame = findScriptedFrame(slideSurface, data.elementId);

  if (!frame || frame.contentWindow !== event.source || frame.dataset.powershowId !== data.elementId) {
    return null;
  }

  const element = findScriptedElement(slide, data.elementId);
  const port = element?.ports.find((candidate) => candidate.id === data.portId);

  if (!element || !port || !outputPort(port) || !validValue(port, data.value)) {
    return null;
  }

  return {
    type: SCRIPTED_REPORT_MESSAGE_TYPE,
    elementId: data.elementId,
    portId: data.portId,
    value: data.value,
  };
}
