import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { createInstanceDemoSvg } from "./instance-demo-asset.mjs";

const root = path.resolve(import.meta.dirname, "..");
const instantiate = path.join(root, "tools", "instantiate.mjs");

function run(configPath, ...args) {
  const env = {
    ...process.env,
    WEB_SLIDESHOW_INSTANCE_CONFIG: configPath,
    WEB_SLIDESHOW_ASSET_ROOT: path.dirname(configPath),
  };
  delete env.WEB_SLIDESHOW_DISPLAY_NAME;

  return spawnSync(process.execPath, [instantiate, ...args], {
    cwd: root,
    env,
    encoding: "utf8",
  });
}

function readDisplayName(configPath, environmentDisplayName) {
  const env = {
    ...process.env,
    WEB_SLIDESHOW_INSTANCE_CONFIG: configPath,
  };
  if (environmentDisplayName === undefined) {
    delete env.WEB_SLIDESHOW_DISPLAY_NAME;
  } else {
    env.WEB_SLIDESHOW_DISPLAY_NAME = environmentDisplayName;
  }

  const result = spawnSync(process.execPath, ["--input-type=module", "-e", "import { readInstanceDisplayName } from './tools/instance-config.mjs'; console.log(readInstanceDisplayName())"], {
    cwd: root,
    env,
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  return result.stdout.trim();
}

function createConfigDirectory(displayName) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "web-slideshow-instance-"));
  fs.writeFileSync(path.join(directory, "instance.json"), JSON.stringify({ displayName }), "utf8");
  return directory;
}

test("instantiate accepts, persists, and replaces a display name", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "web-slideshow-instance-"));
  try {
    const configPath = path.join(directory, "instance.json");

    const first = run(configPath, "--name", "Batata Chip");
    assert.equal(first.status, 0);
    assert.match(first.stdout, /Batata Chip/);
    assert.deepEqual(JSON.parse(fs.readFileSync(configPath, "utf8")), { displayName: "Batata Chip" });

    const second = run(configPath, "--name", "Café Präsentation");
    assert.equal(second.status, 0);
    assert.deepEqual(JSON.parse(fs.readFileSync(configPath, "utf8")), { displayName: "Café Präsentation" });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("instantiate rejects a missing or whitespace-only name", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "web-slideshow-instance-"));
  try {
    const configPath = path.join(directory, "instance.json");

    for (const name of [undefined, "   "]) {
      const args = name === undefined ? [] : ["--name", name];
      const result = run(configPath, ...args);
      assert.notEqual(result.status, 0);
      assert.equal(fs.existsSync(configPath), false);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("environment display name overrides local instance config", () => {
  const directory = createConfigDirectory("Local Name");
  try {
    assert.equal(readDisplayName(path.join(directory, "instance.json"), "Batata Chip"), "Batata Chip");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("environment display name is trimmed", () => {
  const directory = createConfigDirectory("Local Name");
  try {
    assert.equal(readDisplayName(path.join(directory, "instance.json"), "  Batata Chip  "), "Batata Chip");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("whitespace-only environment display name falls back to local config", () => {
  const directory = createConfigDirectory("Local Name");
  try {
    assert.equal(readDisplayName(path.join(directory, "instance.json"), "   "), "Local Name");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("absent environment display name uses configured local display name", () => {
  const directory = createConfigDirectory("Local Name");
  try {
    assert.equal(readDisplayName(path.join(directory, "instance.json")), "Local Name");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("unconfigured reads use the neutral fallback", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "web-slideshow-instance-"));
  try {
    assert.equal(readDisplayName(path.join(directory, "missing.json")), "Presentation");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("the generated demo asset visibly uses the configured instance name", () => {
  const svg = createInstanceDemoSvg("Batata Chip");

  assert.match(svg, /Batata Chip/);
  assert.doesNotMatch(svg, new RegExp(["Power", "Show"].join("")));
});
