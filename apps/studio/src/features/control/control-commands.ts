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

export interface SlideCommand {
  activationRevision: number;
  revision: number;
  slideIndex: number;
}

export interface SlideAck {
  activationRevision: number;
  revision: number;
  slideIndex: number;
}

export function buildSlideCommandPath(): string {
  return "live/slideCommand";
}

export function buildSlideAckPath(): string {
  return "live/slideAck";
}

export function buildSlideCommand(
  activationRevision: number,
  revision: number,
  slideIndex: number,
): SlideCommand {
  return { activationRevision, revision, slideIndex };
}
