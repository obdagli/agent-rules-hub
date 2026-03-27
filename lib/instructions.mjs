import path from "node:path";
import { promises as fs } from "node:fs";

import { CLI_PROFILES, HUB_FILES, REPO_ROOT } from "./hub-config.mjs";

export function composeManagedInstruction({
  toolId,
  toolLabel,
  baselinePath,
  overlayPath,
  baselineContent,
  overlayContent
}) {
  return [
    "<!-- GENERATED FILE. EDIT THE SOURCE LAYERS INSTEAD. -->",
    `<!-- tool: ${toolId} -->`,
    `<!-- sources: ${baselinePath} | ${overlayPath} -->`,
    "",
    `# ${toolLabel} Home Instructions`,
    "",
    `This file is generated from:`,
    `- ${baselinePath}`,
    `- ${overlayPath}`,
    "",
    "---",
    "",
    baselineContent.trim(),
    "",
    "---",
    "",
    overlayContent.trim(),
    ""
  ].join("\n");
}

async function readUtf8(filePath) {
  return fs.readFile(filePath, "utf8");
}

export function toInstructionSourceLabel(filePath) {
  const relativePath = path.relative(REPO_ROOT, filePath);
  if (!relativePath || relativePath.startsWith("..")) {
    return filePath;
  }

  return relativePath.split(path.sep).join("/");
}

export async function renderInstruction(toolId) {
  const profile = CLI_PROFILES[toolId];
  if (!profile) {
    throw new Error(`Unknown profile: ${toolId}`);
  }

  const [baselineContent, overlayContent] = await Promise.all([
    readUtf8(HUB_FILES.baselinePolicy),
    readUtf8(profile.overlayPath)
  ]);

  const output = composeManagedInstruction({
    toolId: profile.id,
    toolLabel: profile.label,
    baselinePath: toInstructionSourceLabel(HUB_FILES.baselinePolicy),
    overlayPath: toInstructionSourceLabel(profile.overlayPath),
    baselineContent,
    overlayContent
  });

  await fs.mkdir(path.dirname(profile.generatedPath), { recursive: true });
  await fs.writeFile(profile.generatedPath, output, "utf8");

  return {
    toolId: profile.id,
    outputPath: profile.generatedPath
  };
}

export async function renderAllInstructions() {
  const results = [];

  for (const toolId of Object.keys(CLI_PROFILES)) {
    results.push(await renderInstruction(toolId));
  }

  return results;
}

export function isInstructionSourcePath(filePath) {
  return filePath === HUB_FILES.baselinePolicy || Object.values(CLI_PROFILES).some((profile) => profile.overlayPath === filePath);
}
