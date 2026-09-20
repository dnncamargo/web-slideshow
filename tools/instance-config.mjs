import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = path.resolve(toolsDirectory, "..");
export const instanceConfigPath = process.env.WEB_SLIDESHOW_INSTANCE_CONFIG
  ? path.resolve(process.env.WEB_SLIDESHOW_INSTANCE_CONFIG)
  : path.join(repositoryRoot, ".instance", "instance.json");

export function readInstanceDisplayName() {
  const environmentDisplayName = process.env.WEB_SLIDESHOW_DISPLAY_NAME?.trim();
  if (environmentDisplayName) {
    return environmentDisplayName;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(instanceConfigPath, "utf8"));
    return typeof parsed.displayName === "string" && parsed.displayName.trim()
      ? parsed.displayName.trim()
      : "Presentation";
  } catch {
    return "Presentation";
  }
}

export function writeInstanceConfig(displayName) {
  fs.mkdirSync(path.dirname(instanceConfigPath), { recursive: true });
  fs.writeFileSync(
    instanceConfigPath,
    `${JSON.stringify({ displayName }, null, 2)}\n`,
    "utf8",
  );
}
