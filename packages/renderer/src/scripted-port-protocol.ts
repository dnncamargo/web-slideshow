// Concrete message contract shared by the Scripted sandbox bootstrap and its
// future renderer-owned host bridge. This is intentionally not a generic
// iframe or runtime protocol.
export const SCRIPTED_ACTION_MESSAGE_TYPE = "powershow:scripted:action";

export const SCRIPTED_INPUT_MESSAGE_TYPE = "powershow:scripted:input";

export const SCRIPTED_REPORT_MESSAGE_TYPE = "powershow:scripted:report";

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

export type ScriptedReportMessage = {
  type: typeof SCRIPTED_REPORT_MESSAGE_TYPE;
  elementId: string;
  portId: string;
  value: boolean | number;
};
