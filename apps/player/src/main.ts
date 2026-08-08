import "./player.css";

import { demoPresentation } from "./demo-presentation";

import { mountPlayer } from "./player";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("PowerShow Player root element was not found.");
}

mountPlayer(root, demoPresentation, {
  transition: "fade",
  controlsAutoHideMs: 2500,
});
  