import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PresentationSchema,
  type Presentation,
} from "@powershow/document-schema";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  ref: vi.fn(),
  onValue: vi.fn(),
}));

vi.mock("firebase/database", () => ({
  get: mocks.get,
  ref: mocks.ref,
  onValue: mocks.onValue,
}));

import {
  parseEntrySearch,
  parseLiveCurrent,
  readLiveCurrent,
  resolveLiveIdentityMount,
  resolveLiveMount,
  subscribeLiveCurrent,
} from "../src/live-entry";

function validPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "pres-1",
    title: "Published",
    description: "",
    aspectRatio: "16:9",
    slides: [
      { id: "slide-1", title: "", summary: "", speakerNotes: "", elements: [] },
    ],
  });
}

function snapshot(val: unknown, exists = true) {
  return { exists: () => exists, val: () => val };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("parseEntrySearch", () => {
  it("reads only the logs flag and ignores legacy publication/version params", () => {
    const result = parseEntrySearch("?publication=old&version=v9&logs=true");

    expect(result.logsEnabled).toBe(true);
  });

  it("reports logs disabled when the flag is absent or not true", () => {
    expect(parseEntrySearch("?publication=old&version=v9").logsEnabled).toBe(
      false,
    );
    expect(parseEntrySearch("?logs=false").logsEnabled).toBe(false);
  });
});

describe("parseLiveCurrent", () => {
  it("accepts a well-formed live/current value", () => {
    const live = parseLiveCurrent({
      publicationId: "pub-1",
      currentVersionId: "v-2",
      revision: 3,
    });

    expect(live).toEqual({
      publicationId: "pub-1",
      currentVersionId: "v-2",
      revision: 3,
    });
  });

  it("rejects a missing or empty publicationId", () => {
    expect(
      parseLiveCurrent({ currentVersionId: "v-2", revision: 1 }),
    ).toBeNull();
    expect(
      parseLiveCurrent({
        publicationId: "",
        currentVersionId: "v-2",
        revision: 1,
      }),
    ).toBeNull();
    expect(
      parseLiveCurrent({
        publicationId: "   ",
        currentVersionId: "v-2",
        revision: 1,
      }),
    ).toBeNull();
    expect(
      parseLiveCurrent({
        publicationId: 42,
        currentVersionId: "v-2",
        revision: 1,
      }),
    ).toBeNull();
  });

  it("rejects a missing or empty currentVersionId", () => {
    expect(
      parseLiveCurrent({ publicationId: "pub-1", revision: 1 }),
    ).toBeNull();
    expect(
      parseLiveCurrent({
        publicationId: "pub-1",
        currentVersionId: "",
        revision: 1,
      }),
    ).toBeNull();
    expect(
      parseLiveCurrent({
        publicationId: "pub-1",
        currentVersionId: "  ",
        revision: 1,
      }),
    ).toBeNull();
    expect(
      parseLiveCurrent({
        publicationId: "pub-1",
        currentVersionId: null,
        revision: 1,
      }),
    ).toBeNull();
  });

  it("rejects a negative or non-integer revision", () => {
    expect(
      parseLiveCurrent({
        publicationId: "pub-1",
        currentVersionId: "v-2",
        revision: -1,
      }),
    ).toBeNull();
    expect(
      parseLiveCurrent({
        publicationId: "pub-1",
        currentVersionId: "v-2",
        revision: 1.5,
      }),
    ).toBeNull();
    expect(
      parseLiveCurrent({
        publicationId: "pub-1",
        currentVersionId: "v-2",
        revision: "1",
      }),
    ).toBeNull();
    expect(
      parseLiveCurrent({ publicationId: "pub-1", currentVersionId: "v-2" }),
    ).toBeNull();
  });

  it("rejects non-object values", () => {
    expect(parseLiveCurrent(null)).toBeNull();
    expect(parseLiveCurrent(undefined)).toBeNull();
    expect(parseLiveCurrent("live")).toBeNull();
  });

  it("trims publication and version ids", () => {
    expect(
      parseLiveCurrent({
        publicationId: " pub-1 ",
        currentVersionId: " v-2 ",
        revision: 3,
      }),
    ).toEqual({
      publicationId: "pub-1",
      currentVersionId: "v-2",
      revision: 3,
    });
  });
});

describe("readLiveCurrent", () => {
  it("returns no-active when live/current does not exist", async () => {
    mocks.ref.mockReturnValue({ path: "live/current" });
    mocks.get.mockResolvedValue(snapshot(null, false));

    const result = await readLiveCurrent({} as never);

    expect(result).toEqual({ kind: "no-active" });
  });

  it("returns ok with the validated live/current", async () => {
    mocks.ref.mockReturnValue({ path: "live/current" });
    mocks.get.mockResolvedValue(
      snapshot({
        publicationId: "pub-1",
        currentVersionId: "v-2",
        revision: 4,
      }),
    );

    const result = await readLiveCurrent({} as never);

    expect(result).toEqual({
      kind: "ok",
      live: { publicationId: "pub-1", currentVersionId: "v-2", revision: 4 },
    });
    expect(mocks.ref).toHaveBeenCalledWith(expect.anything(), "live/current");
  });

  it("returns error when live/current exists but is malformed", async () => {
    mocks.ref.mockReturnValue({ path: "live/current" });
    mocks.get.mockResolvedValue(
      snapshot({ publicationId: "pub-1", currentVersionId: "", revision: 1 }),
    );

    const result = await readLiveCurrent({} as never);

    expect(result).toEqual({ kind: "error" });
  });

  it("returns error without rejecting when the RTDB read fails", async () => {
    mocks.ref.mockReturnValue({ path: "live/current" });
    mocks.get.mockRejectedValue(new Error("permission denied"));

    const result = await readLiveCurrent({} as never);

    expect(result).toEqual({ kind: "error" });
  });
});

describe("subscribeLiveCurrent", () => {
  it("subscribes onValue to live/current and returns a cleanup function", () => {
    const unsub = vi.fn();
    mocks.onValue.mockReturnValue(unsub);
    mocks.ref.mockReturnValue({ path: "live/current" });

    const onEvent = vi.fn();
    const cleanup = subscribeLiveCurrent({} as never, onEvent);

    expect(mocks.ref).toHaveBeenCalledWith(expect.anything(), "live/current");
    expect(mocks.onValue).toHaveBeenCalledTimes(1);

    const handler = mocks.onValue.mock.calls[0]?.[1] as (s: {
      exists: () => boolean;
      val: () => unknown;
    }) => void;

    expect(typeof handler).toBe("function");

    cleanup();

    expect(unsub).toHaveBeenCalledOnce();
  });

  it("emits active for a valid live/current snapshot", () => {
    mocks.onValue.mockReturnValue(vi.fn());
    mocks.ref.mockReturnValue({ path: "live/current" });

    const onEvent = vi.fn();
    subscribeLiveCurrent({} as never, onEvent);

    const handler = mocks.onValue.mock.calls[0]?.[1] as (s: {
      exists: () => boolean;
      val: () => unknown;
    }) => void;

    handler(
      snapshot({
        publicationId: "pub-1",
        currentVersionId: "v-2",
        revision: 4,
      }),
    );

    expect(onEvent).toHaveBeenCalledWith({
      kind: "active",
      live: { publicationId: "pub-1", currentVersionId: "v-2", revision: 4 },
    });
  });

  it("emits no-active when live/current does not exist", () => {
    mocks.onValue.mockReturnValue(vi.fn());
    mocks.ref.mockReturnValue({ path: "live/current" });

    const onEvent = vi.fn();
    subscribeLiveCurrent({} as never, onEvent);

    const handler = mocks.onValue.mock.calls[0]?.[1] as (s: {
      exists: () => boolean;
      val: () => unknown;
    }) => void;

    handler(snapshot(null, false));

    expect(onEvent).toHaveBeenCalledWith({ kind: "no-active" });
  });

  it("emits error for a malformed live/current snapshot", () => {
    mocks.onValue.mockReturnValue(vi.fn());
    mocks.ref.mockReturnValue({ path: "live/current" });

    const onEvent = vi.fn();
    subscribeLiveCurrent({} as never, onEvent);

    const handler = mocks.onValue.mock.calls[0]?.[1] as (s: {
      exists: () => boolean;
      val: () => unknown;
    }) => void;

    handler(snapshot({ publicationId: "", currentVersionId: "v-2", revision: 1 }));

    expect(onEvent).toHaveBeenCalledWith({ kind: "error" });
  });

  it("emits error via the onValue error callback", () => {
    mocks.onValue.mockReturnValue(vi.fn());
    mocks.ref.mockReturnValue({ path: "live/current" });

    const onEvent = vi.fn();
    subscribeLiveCurrent({} as never, onEvent);

    const errorHandler = mocks.onValue.mock.calls[0]?.[2] as () => void;

    errorHandler();

    expect(onEvent).toHaveBeenCalledWith({ kind: "error" });
  });
});

describe("resolveLiveMount", () => {
  const loadVersion =
    vi.fn<(publicationId: string, versionId: string) => Promise<never>>();

  it("loads the exact version and returns ok when live/current is valid", async () => {
    mocks.ref.mockReturnValue({ path: "live/current" });
    mocks.get.mockResolvedValue(
      snapshot({
        publicationId: "pub-1",
        currentVersionId: "v-2",
        revision: 4,
      }),
    );
    loadVersion.mockResolvedValue({
      kind: "ok",
      presentation: validPresentation(),
    } as never);

    const result = await resolveLiveMount({} as never, loadVersion);

    expect(loadVersion).toHaveBeenCalledExactlyOnceWith("pub-1", "v-2");
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.publicationId).toBe("pub-1");
      expect(result.activationRevision).toBe(4);
      expect(result.presentation.id).toBe("pres-1");
    }
  });

  it("returns no-active and never loads a version when live/current is absent", async () => {
    mocks.ref.mockReturnValue({ path: "live/current" });
    mocks.get.mockResolvedValue(snapshot(null, false));

    const result = await resolveLiveMount({} as never, loadVersion);

    expect(result).toEqual({ kind: "no-active" });
    expect(loadVersion).not.toHaveBeenCalled();
  });

  it("returns error and never loads a version when live/current is malformed", async () => {
    mocks.ref.mockReturnValue({ path: "live/current" });
    mocks.get.mockResolvedValue(
      snapshot({ publicationId: "", currentVersionId: "v-2", revision: 1 }),
    );

    const result = await resolveLiveMount({} as never, loadVersion);

    expect(result).toEqual({ kind: "error" });
    expect(loadVersion).not.toHaveBeenCalled();
  });

  it("returns error when the live/current read fails", async () => {
    mocks.ref.mockReturnValue({ path: "live/current" });
    mocks.get.mockRejectedValue(new Error("read failed"));

    const result = await resolveLiveMount({} as never, loadVersion);

    expect(result).toEqual({ kind: "error" });
    expect(loadVersion).not.toHaveBeenCalled();
  });

  it("returns not-found when the exact version does not exist", async () => {
    mocks.ref.mockReturnValue({ path: "live/current" });
    mocks.get.mockResolvedValue(
      snapshot({
        publicationId: "pub-1",
        currentVersionId: "v-missing",
        revision: 1,
      }),
    );
    loadVersion.mockResolvedValue({ kind: "not-found" } as never);

    const result = await resolveLiveMount({} as never, loadVersion);

    expect(result).toEqual({ kind: "not-found" });
    expect(loadVersion).toHaveBeenCalledExactlyOnceWith("pub-1", "v-missing");
  });

  it("returns error when the exact version is malformed", async () => {
    mocks.ref.mockReturnValue({ path: "live/current" });
    mocks.get.mockResolvedValue(
      snapshot({
        publicationId: "pub-1",
        currentVersionId: "v-bad",
        revision: 1,
      }),
    );
    loadVersion.mockResolvedValue({ kind: "error" } as never);

    const result = await resolveLiveMount({} as never, loadVersion);

    expect(result).toEqual({ kind: "error" });
  });
});

describe("resolveLiveIdentityMount", () => {
  const loadVersion =
    vi.fn<(publicationId: string, versionId: string) => Promise<never>>();
  const live = { publicationId: "pub-1", currentVersionId: "v-2", revision: 4 };

  it("loads the exact version from the supplied identity without re-reading live/current", async () => {
    loadVersion.mockResolvedValue({
      kind: "ok",
      presentation: validPresentation(),
    } as never);

    const result = await resolveLiveIdentityMount(live, loadVersion);

    expect(loadVersion).toHaveBeenCalledExactlyOnceWith("pub-1", "v-2");
    expect(mocks.get).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: "ok",
      publicationId: "pub-1",
      activationRevision: 4,
      presentation: expect.objectContaining({ id: "pres-1" }),
    });
  });

  it("returns not-found and never reads live/current when the version is absent", async () => {
    loadVersion.mockResolvedValue({ kind: "not-found" } as never);

    const result = await resolveLiveIdentityMount(live, loadVersion);

    expect(result).toEqual({ kind: "not-found" });
    expect(loadVersion).toHaveBeenCalledExactlyOnceWith("pub-1", "v-2");
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("returns error and never reads live/current when the version is malformed", async () => {
    loadVersion.mockResolvedValue({ kind: "error" } as never);

    const result = await resolveLiveIdentityMount(live, loadVersion);

    expect(result).toEqual({ kind: "error" });
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
