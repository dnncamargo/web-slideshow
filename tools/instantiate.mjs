import { readInstanceDisplayName, writeInstanceConfig } from "./instance-config.mjs";
import { writeInstanceDemoAssets } from "./instance-demo-asset.mjs";

const nameIndex = process.argv.indexOf("--name");
const name = nameIndex >= 0 ? process.argv[nameIndex + 1] : undefined;

if (typeof name !== "string" || name.trim().length === 0) {
  console.error('Usage: pnpm instantiate --name "Your application name"');
  process.exitCode = 1;
} else {
  const displayName = name.trim();
  writeInstanceConfig(displayName);
  writeInstanceDemoAssets(displayName);
  console.log(`Instance display name: ${readInstanceDisplayName()}`);
}
