/**
 * Studio presentation-specific timestamp coercion/formatter.
 *
 * PresentationSummary timestamps are typed `unknown` because they come from
 * Firestore server timestamps and are deliberately not normalized into the
 * domain model. Firestore Web SDK returns `Timestamp` instances whose public
 * shape is `{ seconds, nanoseconds }` with `toDate()`/`toMillis()` helpers;
 * persisted data may instead surface that shape as a plain object or, in
 * tests, as other values. This module centralizes safe coercion so the UI
 * never stringifies `[object Object]` and never throws on a malformed value.
 */

export function toPresentationDate(value: unknown): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "object") {
    const candidate = value as {
      seconds?: unknown;
      nanoseconds?: unknown;
      toDate?: unknown;
      toMillis?: unknown;
    };

    // Firestore Timestamp instance exposes toDate()/toMillis().
    if (typeof candidate.toDate === "function") {
      const date = (candidate.toDate as () => unknown)();
      if (date instanceof Date && !Number.isNaN(date.getTime())) {
        return date;
      }
    }

    if (typeof candidate.toMillis === "function") {
      const millis = (candidate.toMillis as () => unknown)();
      if (typeof millis === "number" && Number.isFinite(millis)) {
        return new Date(millis);
      }
    }

    // Plain { seconds, nanoseconds } shape.
    if (typeof candidate.seconds === "number" && Number.isFinite(candidate.seconds)) {
      const nanos =
        typeof candidate.nanoseconds === "number" ? candidate.nanoseconds : 0;
      return new Date(candidate.seconds * 1000 + nanos / 1_000_000);
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    // Epoch milliseconds.
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

export function formatPresentationDate(
  value: unknown,
  locale?: string,
): string | null {
  const date = toPresentationDate(value);

  if (!date) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toLocaleString(locale);
  }
}