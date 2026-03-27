import path from "node:path";
import { spawnSync } from "node:child_process";

import { parseGeminiExtensions } from "../lib/state.mjs";

const superpowersRoot = process.argv[2];

if (!superpowersRoot) {
  console.error("usage: node ensure-gemini-superpowers.mjs <superpowers-root>");
  process.exit(1);
}

function run(args) {
  const result = spawnSync("gemini", args, {
    encoding: "utf8",
    timeout: 30000
  });

  const combined = `${result.stdout || ""}${result.stderr || ""}`.trim();
  if (result.status !== 0) {
    throw new Error(combined || `gemini ${args.join(" ")} failed`);
  }

  return combined;
}

const normalizedRoot = path.normalize(superpowersRoot);
const listed = parseGeminiExtensions(run(["extensions", "list"]));
const installed = listed.find((extension) => extension.name === "superpowers");

if (!installed) {
  run(["extensions", "link", superpowersRoot, "--consent"]);
} else if (
  installed.sourceType !== "link" ||
  path.normalize(installed.source) !== normalizedRoot
) {
  run(["extensions", "uninstall", "superpowers"]);
  run(["extensions", "link", superpowersRoot, "--consent"]);
}

run(["extensions", "enable", "superpowers"]);
console.log(`gemini superpowers ensured from ${superpowersRoot}`);
