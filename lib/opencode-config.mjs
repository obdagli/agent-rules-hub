import path from "node:path";

import { parseJsonc, stringifyJsonc } from "./jsonc.mjs";

const PLUGIN_MODES = {
  "oh-my-opencode": ["oh-my-opencode"],
  superpowers: ["superpowers@git+https://github.com/obra/superpowers.git"],
  both: [
    "oh-my-opencode",
    "superpowers@git+https://github.com/obra/superpowers.git"
  ],
  none: []
};

function normalizeConfigPath(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  return path.normalize(value.trim());
}

function uniquePaths(values) {
  const seen = new Set();
  const output = [];

  for (const value of values) {
    const normalized = normalizeConfigPath(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(value);
  }

  return output;
}

export function pluginEntriesForMode(mode) {
  const entries = PLUGIN_MODES[mode];
  if (!entries) {
    throw new Error(`Unknown OpenCode plugin mode: ${mode}`);
  }
  return [...entries];
}

export function getOpencodeDeliveryState(config, { homePath, generatedPath }) {
  const instructions = Array.isArray(config.instructions)
    ? config.instructions.filter((value) => typeof value === "string")
    : [];

  const normalized = instructions.map((value) => normalizeConfigPath(value));
  const normalizedHome = normalizeConfigPath(homePath);
  const normalizedGenerated = normalizeConfigPath(generatedPath);

  return {
    instructions,
    configuredHomePath: normalized.includes(normalizedHome),
    configuredGeneratedPath: normalized.includes(normalizedGenerated),
    configured: normalized.includes(normalizedHome) || normalized.includes(normalizedGenerated)
  };
}

export function applyOpencodeConfigChanges({
  raw,
  pluginMode,
  ensureInstructionPath
}) {
  const parsed = parseJsonc(raw);
  if (parsed.error) {
    throw new Error(`Could not parse OpenCode config: ${parsed.error}`);
  }

  const next = parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)
    ? { ...parsed.data }
    : {};

  if (pluginMode) {
    next.plugin = pluginEntriesForMode(pluginMode);
  }

  if (ensureInstructionPath) {
    const existing = Array.isArray(next.instructions)
      ? next.instructions.filter((value) => typeof value === "string")
      : [];
    next.instructions = uniquePaths([
      ensureInstructionPath,
      ...existing
    ]);
  }

  const content = stringifyJsonc(next);
  const verification = parseJsonc(content);
  if (verification.error) {
    throw new Error(`Generated OpenCode config is invalid: ${verification.error}`);
  }

  return {
    data: next,
    content
  };
}
