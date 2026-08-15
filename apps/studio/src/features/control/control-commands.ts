export type ControlAction = "next" | "previous";

export interface ControlCommand {
  action: ControlAction;
  revision: number;
}

export function buildControlPath(publicationId: string): string {
  return `controlSpikes/${publicationId}`;
}

export function buildControlCommand(
  action: ControlAction,
  revision: number,
): ControlCommand {
  return { action, revision };
}
