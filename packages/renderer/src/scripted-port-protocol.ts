// Concrete message contract shared by the Scripted sandbox bootstrap and its
// renderer-owned host bridge. These values are internal and deliberately do
// not carry the product/instance name.
export const SCRIPTED_ACTION_MESSAGE_TYPE = "scripted:action";
export const LEGACY_SCRIPTED_ACTION_MESSAGE_TYPE = "powershow:scripted:action";

export const SCRIPTED_INPUT_MESSAGE_TYPE = "scripted:input";
export const LEGACY_SCRIPTED_INPUT_MESSAGE_TYPE = "powershow:scripted:input";

export const SCRIPTED_REPORT_MESSAGE_TYPE = "scripted:report";
export const LEGACY_SCRIPTED_REPORT_MESSAGE_TYPE = "powershow:scripted:report";

export type ScriptedActionMessage = {
  type: typeof SCRIPTED_ACTION_MESSAGE_TYPE;
  elementId: string;
  portId: string;
};

export type ScriptedInputMessage = {
  type: typeof SCRIPTED_INPUT_MESSAGE_TYPE;
  elementId: string;
  portId: string;
  value: boolean | number;
};

type CanonicalScriptedReportMessage = {
  type: typeof SCRIPTED_REPORT_MESSAGE_TYPE;
  elementId: string;
  portId: string;
  value: boolean | number;
};

export type LegacyScriptedReportMessage = Omit<CanonicalScriptedReportMessage, "type"> & {
  type: typeof LEGACY_SCRIPTED_REPORT_MESSAGE_TYPE;
};

export type ScriptedReportMessage = CanonicalScriptedReportMessage | LegacyScriptedReportMessage;
