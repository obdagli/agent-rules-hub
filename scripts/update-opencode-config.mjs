import path from "node:path";
import { promises as fs } from "node:fs";

import { applyOpencodeConfigChanges } from "../lib/opencode-config.mjs";

function usage() {
  console.error("usage: node update-opencode-config.mjs --config <path> [--plugin-mode <mode>] [--ensure-instruction-path <path>]");
  process.exit(1);
}

const args = process.argv.slice(2);
let configPath = "";
let pluginMode = "";
let ensureInstructionPath = "";

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  const value = args[index + 1];

  if (arg === "--config") {
    configPath = value || "";
    index += 1;
    continue;
  }

  if (arg === "--plugin-mode") {
    pluginMode = value || "";
    index += 1;
    continue;
  }

  if (arg === "--ensure-instruction-path") {
    ensureInstructionPath = value || "";
    index += 1;
    continue;
  }

  usage();
}

if (!configPath || (!pluginMode && !ensureInstructionPath)) {
  usage();
}

let raw = "{}\n";
let configExists = true;

try {
  raw = await fs.readFile(configPath, "utf8");
} catch (error) {
  if (error instanceof Error && "code" in error && error.code === "ENOENT") {
    configExists = false;
  } else {
    throw error;
  }
}

const result = applyOpencodeConfigChanges({
  raw,
  pluginMode: pluginMode || undefined,
  ensureInstructionPath: ensureInstructionPath || undefined
});

await fs.mkdir(path.dirname(configPath), { recursive: true });
if (configExists) {
  await fs.copyFile(configPath, `${configPath}.bak`);
}
await fs.writeFile(configPath, result.content, "utf8");

const summary = [];
if (pluginMode) summary.push(`plugin mode: ${pluginMode}`);
if (ensureInstructionPath) summary.push(`managed instructions: ${ensureInstructionPath}`);

console.log(`updated ${configPath} (${summary.join(", ")})`);
