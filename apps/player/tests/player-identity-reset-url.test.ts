import { describe, expect, it, vi } from "vitest";

import { consumePlayerIdentityResetParameter } from "../src/player-identity-reset-url";

describe("Player identity reset URL", () => {
  it("consumes reset=1 and preserves other query parameters and the hash", () => {
    const replaceUrl = vi.fn();

    expect(consumePlayerIdentityResetParameter(
      "https://player.example/?publication=pub-1&reset=1&view=wide#slide-3",
      replaceUrl,
    )).toBe(true);

    expect(replaceUrl).toHaveBeenCalledWith("/?publication=pub-1&view=wide#slide-3");
  });

  it("does not consume an absent or nonmatching reset parameter", () => {
    const replaceUrl = vi.fn();

    expect(consumePlayerIdentityResetParameter("https://player.example/?view=wide#slide-3", replaceUrl)).toBe(false);
    expect(consumePlayerIdentityResetParameter("https://player.example/?reset=0", replaceUrl)).toBe(false);
    expect(replaceUrl).not.toHaveBeenCalled();
  });

  it("removes every reset value so a reload cannot repeat a one-shot reset", () => {
    const replaceUrl = vi.fn();

    consumePlayerIdentityResetParameter("https://player.example/?reset=0&reset=1&reset=1", replaceUrl);

    expect(replaceUrl).toHaveBeenCalledWith("/");
  });
});
