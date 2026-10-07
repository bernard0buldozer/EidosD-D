import { cpSync, mkdirSync } from "node:fs";
mkdirSync("public/dice-assets", { recursive: true });
cpSync("node_modules/@3d-dice/dice-box/dist/assets", "public/dice-assets", {
  recursive: true,
});
cpSync("node_modules/@3d-dice/dice-box/LICENSE", "public/dice-assets/LICENSE");
