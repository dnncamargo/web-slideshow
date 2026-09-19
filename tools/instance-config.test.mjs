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
  return spawnSync(process.execPath, [instantiate, ...args], {
    cwd: root,
    env: {
      ...process.env,
      WEB_SLIDESHOW_INSTANCE_CONFIG: configPath,
      WEB_SLIDESHOW_ASSET_ROOT: path.dirname(configPath),
    },
    encoding: "utf8",
  });
}

test("instantiate accepts, persists, and replaces a display name", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "web-slideshow-instance-"));
  const configPath = path.join(directory, "instance.json");

  const first = run(configPath, "--name", "Batata Chip");
  assert.equal(first.status, 0);
  assert.match(first.stdout, /Batata Chip/);
  assert.deepEqual(JSON.parse(fs.readFileSync(configPath, "utf8")), { displayName: "Batata Chip" });

  const second = run(configPath, "--name", "Café Präsentation");
  assert.equal(second.status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(configPath, "utf8")), { displayName: "Café Präsentation" });
});

test("instantiate rejects a missing or whitespace-only name", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "web-slideshow-instance-"));
  const configPath = path.join(directory, "instance.json");

  for (const name of [undefined, "   "]) {
    const args = name === undefined ? [] : ["--name", name];
    const result = run(configPath, ...args);
    assert.notEqual(result.status, 0);
    assert.equal(fs.existsSync(configPath), false);
  }
});

test("unconfigured reads use the neutral fallback", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "web-slideshow-instance-"));
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", "import { readInstanceDisplayName } from './tools/instance-config.mjs'; console.log(readInstanceDisplayName())"], {
    cwd: root,
    env: { ...process.env, WEB_SLIDESHOW_INSTANCE_CONFIG: path.join(directory, "missing.json") },
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), "Presentation");
});

test("the generated demo asset visibly uses the configured instance name", () => {
  const svg = createInstanceDemoSvg("Batata Chip");

  assert.match(svg, /Batata Chip/);
  assert.doesNotMatch(svg, /PowerShow/);
});
