import { buildAuthenticatedLivePath } from "../live/live-path";

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
  currentVersionId: string;
  revision: number;
  pageId: string;
}

export interface SlideAck {
  activationRevision: number;
  currentVersionId: string;
  revision: number;
  pageId: string;
  pageIndex: number;
}

export interface FullscreenRequest {
  activationRevision: number;
  currentVersionId: string;
  revision: number;
}

export function buildFullscreenRequestPath(): string {
  return buildAuthenticatedLivePath("fullscreenRequest");
}

export function buildFullscreenRequest(
  activationRevision: number,
  currentVersionId: string,
  revision: number,
): FullscreenRequest {
  return { activationRevision, currentVersionId, revision };
}

export function buildSlideCommandPath(): string {
  return buildAuthenticatedLivePath("slideCommand");
}

export function buildSlideAckPath(): string {
  return buildAuthenticatedLivePath("slideAck");
}

export function buildSlideCommand(
  activationRevision: number,
  currentVersionId: string,
  revision: number,
  pageId: string,
): SlideCommand {
  return { activationRevision, currentVersionId, revision, pageId };
}
