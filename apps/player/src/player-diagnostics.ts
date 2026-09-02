// ============================================================
// PLAYER DIAGNOSTICS (OBSERVABILITY-ONLY)
//
// A small, self-contained diagnostic facility for devices where
// browser devtools/console cannot be reached (e.g. Android
// interactive displays). Enabled with ?logs=true.
//
// INVARIANTS
//   - strictly observational: a failure (DOM, localStorage,
//     serialization, ...) is always swallowed and never breaks or
//     alters the Player execution path;
//   - when disabled the public API is effectively a no-op and must
//     not touch localStorage or the DOM;
//   - when enabled, events are persisted to a versioned, bounded
//     ring buffer in localStorage (max 100) and a visible monospace
//     panel is rendered OUTSIDE #app so Player rendering cannot
//     remove it.
//
// Do NOT persist: Firebase configuration, API keys, auth data,
// tokens, or full stack traces. Error objects are reduced to their
// safe name/code/message fields.
// ============================================================

export type PlayerDiagnosticCode =
  | "BOOT"
  | "RTDB_INIT_START"
  | "RTDB_INIT_OK"
  | "RTDB_INIT_MISSING"
  | "RTDB_INIT_ERROR"
  | "LIVE_EVENT_ACTIVE"
  | "LIVE_EVENT_NO_ACTIVE"
  | "LIVE_EVENT_ERROR"
  | "PLAYER_MOUNT_START"
  | "PLAYER_MOUNT_OK"
  | "PLAYER_MOUNT_ERROR"
  | "LIVE_PROJECTION_ATTACH_START"
  | "LIVE_PROJECTION_ATTACH_OK"
  | "LIVE_PROJECTION_ATTACH_ERROR"
  | "RTDB_LIVE_SUBSCRIBE_START"
  | "RTDB_LIVE_ACTIVE"
  | "RTDB_LIVE_NO_ACTIVE"
  | "RTDB_LIVE_MALFORMED"
  | "RTDB_LIVE_SUBSCRIBE_ERROR"
  | "FIRESTORE_LOAD_START"
  | "FIRESTORE_CONFIG_MISSING"
  | "FIRESTORE_LOAD_NOT_FOUND"
  | "FIRESTORE_SCHEMA_ERROR"
  | "FIRESTORE_LOAD_OK"
  | "FIRESTORE_LOAD_ERROR"
  | "PLAYER_STATE_ATTACH_START"
  | "PLAYER_STATE_WRITE_START"
  | "PLAYER_STATE_WRITE_OK"
  | "PLAYER_STATE_WRITE_ERROR"
  | "PLAYER_PRESENCE_WRITE_ERROR"
  | "PLAYER_RECOVERY_SUBSCRIBE_ERROR"
  | "PLAYER_RECOVERY_RELOAD"
  | "PLAYER_RECOVERY_RETRY"
  | "PLAYER_RECOVERY_RETRY_ERROR"
  | "CONTROL_STATE_SUBSCRIBE_ERROR";

export interface PlayerDiagnosticEvent {
  sequence: number;
  timestamp: string;
  sessionId: string;
  code: PlayerDiagnosticCode;
  details?: unknown;
}

interface StorageLike {
  getItem(key: string): string | null;

  setItem(key: string, value: string): void;
}

const PLAYER_DIAGNOSTICS_STORAGE_KEY = "powershow:player-diagnostics:v1";

const MAX_EVENTS = 100;

const PANEL_ELEMENT_ID = "powershow-player-diagnostics";

let enabled = false;

let sessionId: string | null = null;

let sequence = 0;

let events: PlayerDiagnosticEvent[] = [];

let panelElement: HTMLElement | null = null;

let panelLogElement: HTMLElement | null = null;

// ============================================================
// STORAGE
// ============================================================

function getStorage(): StorageLike | null {
  try {
    return (globalThis as { localStorage?: StorageLike }).localStorage ?? null;
  } catch {
    return null;
  }
}

function serializeEventArray(value: PlayerDiagnosticEvent[]): string | null {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function persistEvents(): void {
  const serialized = serializeEventArray(events);

  if (serialized === null) {
    return;
  }

  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(PLAYER_DIAGNOSTICS_STORAGE_KEY, serialized);
  } catch {
    // Never break the Player because diagnostics could not persist.
  }
}

function normalizeStoredEvent(value: unknown): PlayerDiagnosticEvent | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  const storedSequence = record.sequence;
  const storedTimestamp = record.timestamp;
  const storedSessionId = record.sessionId;
  const storedCode = record.code;

  if (
    typeof storedSequence !== "number" ||
    !Number.isInteger(storedSequence)
  ) {
    return null;
  }

  if (typeof storedTimestamp !== "string" || storedTimestamp === "") {
    return null;
  }

  if (typeof storedSessionId !== "string" || storedSessionId.trim() === "") {
    return null;
  }

  if (typeof storedCode !== "string" || storedCode === "") {
    return null;
  }

  const event: PlayerDiagnosticEvent = {
    sequence: storedSequence,
    timestamp: storedTimestamp,
    sessionId: storedSessionId,
    code: storedCode as PlayerDiagnosticCode,
    ...(record.details !== undefined ? { details: record.details } : {}),
  };

  return event;
}

function loadStoredEvents(): PlayerDiagnosticEvent[] {
  const storage = getStorage();

  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(PLAYER_DIAGNOSTICS_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const loaded: PlayerDiagnosticEvent[] = [];

    for (const item of parsed) {
      const event = normalizeStoredEvent(item);

      if (event !== null) {
        loaded.push(event);
      }
    }

    return loaded.slice(-MAX_EVENTS);
  } catch {
    return [];
  }
}

// ============================================================
// SAFE SERIALIZATION
// ============================================================

function toSafeValue(value: unknown, depth: number): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const valueType = typeof value;

  if (valueType === "string" || valueType === "boolean") {
    return value;
  }

  if (valueType === "number") {
    return Number.isFinite(value) ? value : String(value);
  }

  if (valueType === "bigint") {
    return String(value);
  }

  if (valueType === "function" || valueType === "symbol") {
    return undefined;
  }

  if (value instanceof Error) {
    const record: Record<string, unknown> = {
      name: value.name,
      message: value.message,
    };

    // Preserve a Firebase-style error code when present on the Error.
    const code = (value as { code?: unknown }).code;

    if (typeof code === "string" && code.trim() !== "") {
      record.code = code;
    }

    return record;
  }

  if (depth >= 32) {
    return "<truncated>";
  }

  if (Array.isArray(value)) {
    const out: unknown[] = [];

    for (const item of value.slice(0, 40)) {
      const safe = toSafeValue(item, depth + 1);

      if (safe !== undefined) {
        out.push(safe);
      }
    }

    return out;
  }

  if (valueType === "object") {
    const record: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const safe = toSafeValue(entry, depth + 1);

      if (safe !== undefined) {
        record[key] = safe;
      }
    }

    return record;
  }

  return String(value);
}

function sanitizeDetails(details: unknown): unknown {
  try {
    return toSafeValue(details, 0);
  } catch {
    return { unsafe: true };
  }
}

// ============================================================
// PANEL (DOM, SIMPLE CSS, OUTSIDE #app)
// ============================================================

const PANEL_STYLE = [
  "position:fixed",
  "top:12px",
  "left:12px",
  "bottom:12px",
  "width:380px",
  "z-index:2147483647",
  "display:flex",
  "flex-direction:column",
  "overflow:hidden",
  "background:rgba(0,0,0,0.88)",
  "color:#e2e8f0",
  "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
  "font-size:13px",
  "line-height:1.5",
  "padding:10px",
].join(";");

const PANEL_HEADING_STYLE = [
  "flex:none",
  "font-size:12px",
  "font-weight:600",
  "color:#7dd3fc",
  "margin:0 0 4px",
].join(";");

const PANEL_ENV_STYLE = [
  "flex:none",
  "white-space:pre-wrap",
  "overflow-wrap:anywhere",
  "font-size:11px",
  "color:#94a3b8",
  "max-height:140px",
  "overflow:auto",
  "margin:2px 0 6px",
].join(";");

const PANEL_LOG_STYLE = [
  "flex:1",
  "overflow:auto",
].join(";");

const PANEL_CODE_STYLE = [
  "white-space:pre-wrap",
  "overflow-wrap:anywhere",
  "font-size:12px",
  "color:#e2e8f0",
].join(";");

function navigatorUserAgent(): string {
  try {
    const value = (globalThis as { navigator?: { userAgent?: unknown } }).navigator?.userAgent;

    return typeof value === "string" && value !== "" ? value : "unavailable";
  } catch {
    return "unavailable";
  }
}

function navigatorOnline(): string {
  try {
    const value = (globalThis as { navigator?: { onLine?: unknown } }).navigator?.onLine;

    return typeof value === "boolean" ? String(value) : "unavailable";
  } catch {
    return "unavailable";
  }
}

function formatEventLine(event: PlayerDiagnosticEvent): string {
  const time =
    event.timestamp.length >= 19 ? event.timestamp.slice(11, 19) : event.timestamp;

  let detailsText = "";

  if (event.details !== undefined) {
    try {
      detailsText = ` ${JSON.stringify(event.details)}`;
    } catch {
      detailsText = "";
    }
  }

  return `[${event.sequence}] ${time} | ${event.code}${detailsText}`;
}

function renderPanel(): void {
  if (!enabled || panelLogElement === null) {
    return;
  }

  try {
    panelLogElement.textContent = "";

    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];

      if (event === undefined) {
        continue;
      }

      const line = document.createElement("div");

      line.setAttribute("data-diagnostics-code", event.code);
      line.setAttribute("style", PANEL_CODE_STYLE);
      line.textContent = formatEventLine(event);

      panelLogElement.appendChild(line);
    }
  } catch {
    // Never break playback because the panel could not update.
  }
}

function buildPanel(): HTMLElement | null {
  try {
    const panel = document.createElement("div");

    panel.id = PANEL_ELEMENT_ID;
    panel.setAttribute("data-powershow-diagnostics", "");
    panel.setAttribute("style", PANEL_STYLE);

    const heading = document.createElement("div");
    heading.setAttribute("style", PANEL_HEADING_STYLE);
    heading.textContent = "PowerShow Player Diagnostics";

    const env = document.createElement("div");
    env.setAttribute("style", PANEL_ENV_STYLE);
    env.textContent = [
      `online: ${navigatorOnline()}`,
      `ua: ${navigatorUserAgent()}`,
    ].join("\n");

    const log = document.createElement("div");
    log.setAttribute("data-powershow-diagnostics-log", "");
    log.setAttribute("style", PANEL_LOG_STYLE);

    panel.append(heading, env, log);

    panelLogElement = log;

    return panel;
  } catch {
    panelLogElement = null;

    return null;
  }
}

function ensurePanel(): void {
  if (panelElement !== null || typeof document === "undefined") {
    return;
  }

  try {
    const body = document.body;

    if (!body) {
      return;
    }

    const panel = buildPanel();

    if (panel !== null) {
      body.appendChild(panel);
      panelElement = panel;

      renderPanel();
    }
  } catch {
    // Never let diagnostics fail playback.
    panelElement = null;
  }
}

// ============================================================
// PUBLIC API
// ============================================================

export function configurePlayerDiagnostics(nextEnabled: boolean): void {
  enabled = nextEnabled;

  if (!nextEnabled) {
    return;
  }

  if (sessionId === null) {
    sessionId = generateSessionId();
    events = loadStoredEvents();
    sequence =
      events.reduce((max, event) => (event.sequence > max ? event.sequence : max), 0) + 1;
  }

  ensurePanel();
}

export function recordPlayerDiagnostic(
  code: PlayerDiagnosticCode,
  details?: unknown,
): void {
  if (!enabled) {
    return;
  }

  const event: PlayerDiagnosticEvent = {
    sequence,
    timestamp: new Date().toISOString(),
    sessionId: sessionId ?? "",
    code,
    ...(details !== undefined ? { details: sanitizeDetails(details) } : {}),
  };

  sequence += 1;

  events.push(event);

  if (events.length > MAX_EVENTS) {
    events = events.slice(-MAX_EVENTS);
  }

  persistEvents();

  renderPanel();
}

function generateSessionId(): string {
  const random = Math.random().toString(36).slice(2, 10);

  return `${Date.now().toString(36)}-${random}`;
}
