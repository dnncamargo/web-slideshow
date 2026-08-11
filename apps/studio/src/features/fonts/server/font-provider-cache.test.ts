import { describe, expect, it, vi } from "vitest";

import { TtlCache } from "./font-provider-cache";

describe("TtlCache", () => {
  it("reuses a value before the TTL and reloads it after expiry", async () => {
    let now = 1_000;
    const cache = new TtlCache(500, () => now);
    const loader = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");

    await expect(cache.getOrLoad(loader)).resolves.toBe("first");

    now = 1_499;
    await expect(cache.getOrLoad(loader)).resolves.toBe("first");
    expect(loader).toHaveBeenCalledTimes(1);

    now = 1_500;
    await expect(cache.getOrLoad(loader)).resolves.toBe("second");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("shares an in-flight load", async () => {
    let resolveValue: ((value: string) => void) | undefined;
    const loader = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveValue = resolve;
        }),
    );
    const cache = new TtlCache<string>();
    const first = cache.getOrLoad(loader);
    const second = cache.getOrLoad(loader);

    resolveValue?.("loaded");

    await expect(Promise.all([first, second])).resolves.toEqual([
      "loaded",
      "loaded",
    ]);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

