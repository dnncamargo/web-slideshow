import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "./instance-config.mjs";

function escapeXml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&apos;",
    '"': "&quot;",
  })[character]);
}

export function createInstanceDemoSvg(displayName) {
  const safeName = escapeXml(displayName);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700" role="img" aria-labelledby="title desc">
  <title id="title">${safeName} demo image</title>
  <desc id="desc">Demo image for the ${safeName} presentation application.</desc>
  <defs><linearGradient id="background" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#0f172a"/><stop offset="1" stop-color="#164e63"/></linearGradient></defs>
  <rect width="1200" height="700" rx="44" fill="url(#background)"/>
  <circle cx="930" cy="170" r="170" fill="#22d3ee" opacity=".18"/>
  <circle cx="1040" cy="500" r="230" fill="#a78bfa" opacity=".16"/>
  <text x="90" y="280" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="64" font-weight="700">${safeName}</text>
  <text x="94" y="350" fill="#67e8f9" font-family="Arial, sans-serif" font-size="30">Instance demo image</text>
  <path d="M94 420h360" stroke="#22d3ee" stroke-linecap="round" stroke-width="8"/>
</svg>\n`;
}

export function writeInstanceDemoAssets(displayName) {
  const svg = createInstanceDemoSvg(displayName);
  const assetRoot = process.env.WEB_SLIDESHOW_ASSET_ROOT
    ? path.resolve(process.env.WEB_SLIDESHOW_ASSET_ROOT)
    : repositoryRoot;
  for (const relativePath of ["apps/studio/public/instance-demo.svg", "apps/player/public/instance-demo.svg"]) {
    const target = path.join(assetRoot, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, svg, "utf8");
  }
}
