import { describe, expect, it } from "vitest";

import watchPageSource from "../src/app/watch/page.tsx?raw";
import watchPageClientSource from "../src/features/watch/watch-page.tsx?raw";
import watchSessionSource from "../src/features/watch/use-watch-session.ts?raw";

const WATCH_SOURCES = [watchPageSource, watchPageClientSource, watchSessionSource];

describe("/watch route contract", () => {
  it("A: /watch is public and does not depend on the authorization gate", () => {
    expect(watchPageSource).not.toMatch(/studio-auth-gate/i);
    expect(watchPageSource).not.toMatch(/@\/features\/auth\//);
    expect(watchPageSource).toContain("WatchPage");
    expect(watchPageClientSource).not.toMatch(/studio-auth-gate/i);
    expect(watchPageClientSource).not.toMatch(/@\/features\/auth\//);
  });

  it("does not read the Control-owned desired state stream", () => {
    for (const source of WATCH_SOURCES) {
      expect(source).not.toContain("buildControlStatePath");
      expect(source).not.toContain("parseLiveControlState");
      expect(source).not.toContain("LiveControlState");
    }
  });

  it("does not read slideCommand or slideAck", () => {
    for (const source of WATCH_SOURCES) {
      expect(source).not.toContain("slideCommand");
      expect(source).not.toContain("slideAck");
    }
  });

  it("does not import or call any live writers or presence logic", () => {
    for (const source of WATCH_SOURCES) {
      expect(source).not.toContain("control-command-writer");
      expect(source).not.toContain("writeControlState");
      expect(source).not.toContain("activateLivePresentation");
      expect(source).not.toContain("promoteLivePresentationVersion");
      expect(source).not.toContain("endLivePresentation");
      expect(source).not.toContain("onDisconnect");
    }
  });

  it("J: does not observe the public publication pointer", () => {
    for (const source of WATCH_SOURCES) {
      expect(source).not.toContain("subscribePointer");
    }
  });

  it("N: performs zero RTDB writes at the source level", () => {
    for (const source of WATCH_SOURCES) {
      expect(source).not.toContain("runTransaction");
      expect(source).not.toContain(".set(");
      expect(source).not.toContain(".update(");
      expect(source).not.toContain("update(");
      expect(source).not.toContain("remove(");
    }
  });

  it("subscribes to the read-only Live streams it is allowed to read", () => {
    expect(watchSessionSource).toContain("live/current");
    expect(watchSessionSource).toContain("buildPlayerStatePath");
    expect(watchSessionSource).toContain("parseLivePlayerState");
  });
});
