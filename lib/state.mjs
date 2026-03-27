import path from "node:path";
import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";

import { CLI_PROFILES, HOME, HUB_FILES, KNOWN_CAPABILITIES, REPO_ROOT, SUPERPOWERS_ROOT } from "./hub-config.mjs";
import { parseJsonc } from "./jsonc.mjs";
import { getOpencodeDeliveryState } from "./opencode-config.mjs";

const CODEX_ORCHESTRATOR_MODES = new Set(["superpowers-primary", "omx-primary", "hybrid-tools-only", "custom"]);
const DISCOVERABLE_RULE_FILES = new Map([
  ["AGENTS.md", { cliTargets: ["codex", "claude", "gemini", "opencode"] }],
  ["CLAUDE.md", { cliTargets: ["claude"] }],
  ["GEMINI.md", { cliTargets: ["gemini"] }],
  ["default-instructions.md", { cliTargets: ["opencode"] }]
]);
const DISCOVERY_IGNORED_DIRS = new Set([".git", "node_modules", ".omx", "dist", "build", "coverage"]);

function shell(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || REPO_ROOT,
    encoding: "utf8",
    timeout: options.timeout || 20000
  });

  if (result.error) {
    return {
      ok: false,
      code: 1,
      stdout: "",
      stderr: result.error.message,
      combined: result.error.message
    };
  }

  return {
    ok: result.status === 0,
    code: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    combined: `${result.stdout || ""}${result.stderr || ""}`.trim()
  };
}

export async function readFileSafe(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function statExists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function realpathSafe(filePath) {
  try {
    return await fs.realpath(filePath);
  } catch {
    return "";
  }
}

async function listDirNames(dirPath, { onlyDirectories = true } = {}) {
  if (!(await statExists(dirPath))) return [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const names = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (!onlyDirectories) {
      names.push(entry.name);
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      names.push(entry.name);
      continue;
    }

    if (entry.isSymbolicLink()) {
      try {
        const resolved = await fs.stat(fullPath);
        if (resolved.isDirectory()) names.push(entry.name);
      } catch {
        // Ignore broken symlinks.
      }
    }
  }

  return names.sort((a, b) => a.localeCompare(b));
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseOptionalJsonc(raw) {
  if (!raw.trim()) {
    return {
      data: {},
      error: null
    };
  }

  return parseJsonc(raw);
}

function parseTomlScalar(raw) {
  const value = raw.trim();

  if (!value) return "";
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+$/.test(value)) return Number(value);

  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];

    return inner
      .split(",")
      .map((entry) => parseTomlScalar(entry))
      .filter((entry) => entry !== "");
  }

  return value;
}

function parseTomlConfig(raw) {
  const sections = new Map();
  const root = {};
  let currentSection = null;

  for (const sourceLine of raw.split(/\r?\n/)) {
    const line = sourceLine.replace(/\s+#.*$/, "").trim();
    if (!line) continue;

    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      if (!sections.has(currentSection)) {
        sections.set(currentSection, {});
      }
      continue;
    }

    const assignmentMatch = line.match(/^([A-Za-z0-9_.\/"-]+)\s*=\s*(.+)$/);
    if (!assignmentMatch) continue;

    const [, rawKey, rawValue] = assignmentMatch;
    const key = rawKey.replace(/^"(.*)"$/, "$1");
    const value = parseTomlScalar(rawValue);

    if (!currentSection) {
      root[key] = value;
      continue;
    }

    sections.get(currentSection)[key] = value;
  }

  return {
    data: {
      root,
      sections
    },
    error: null
  };
}

function pushFact(facts, label, value) {
  if (value === undefined || value === null || value === "") return;
  facts.push([label, String(value)]);
}

function formatToggle(value) {
  return value ? "on" : "off";
}

function summarizeClaudeRuntimeConfig(config) {
  const facts = [];
  const env = config && typeof config.env === "object" ? config.env : {};

  pushFact(facts, "Gateway", env.ANTHROPIC_BASE_URL);
  pushFact(facts, "Selected model", config?.model);
  pushFact(facts, "Opus target", env.ANTHROPIC_DEFAULT_OPUS_MODEL);
  pushFact(facts, "Sonnet target", env.ANTHROPIC_DEFAULT_SONNET_MODEL);
  pushFact(facts, "Haiku target", env.ANTHROPIC_DEFAULT_HAIKU_MODEL);
  pushFact(facts, "Subagent model", env.CLAUDE_CODE_SUBAGENT_MODEL);

  return facts;
}

function summarizeCodexRuntimeConfig(config) {
  const facts = [];
  const root = config?.root || {};
  const sections = config?.sections || new Map();
  const providerId = root.model_provider;
  const providerSection = providerId ? sections.get(`model_providers.${providerId}`) : null;
  const features = sections.get("features") || {};

  pushFact(facts, "Provider", providerId);
  pushFact(facts, "Gateway", providerSection?.base_url);
  pushFact(facts, "Model", root.model);
  pushFact(facts, "Reasoning", root.reasoning_effort);
  pushFact(facts, "Model reasoning", root.model_reasoning_effort);
  pushFact(facts, "Plan reasoning", root.plan_mode_reasoning_effort);
  if (typeof features.multi_agent === "boolean") {
    pushFact(facts, "Multi-agent", formatToggle(features.multi_agent));
  }

  return facts;
}

function summarizeOpenCodeRuntimeConfig(config) {
  const facts = [];

  pushFact(facts, "Default agent", config?.default_agent);
  pushFact(facts, "Model", config?.model);
  pushFact(facts, "Small model", config?.small_model);
  if (Array.isArray(config?.plugin)) {
    pushFact(facts, "Plugins", config.plugin.length ? config.plugin.join(", ") : "(none)");
  }

  return facts;
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function buildEntryId(prefix, filePath) {
  return `${prefix}:${toPosixPath(filePath).replace(/[^A-Za-z0-9._/-]+/g, "-")}`;
}

function compactDiscoveredPath(filePath) {
  if (!filePath) return "";

  if (filePath.startsWith(REPO_ROOT)) {
    return toPosixPath(path.relative(REPO_ROOT, filePath));
  }

  if (filePath.startsWith(HOME)) {
    const relativeHomePath = path.relative(HOME, filePath);
    return relativeHomePath ? `~/${toPosixPath(relativeHomePath)}` : "~";
  }

  return toPosixPath(filePath);
}

async function walkDiscoverableFiles(rootPath, {
  maxDepth = 4,
  includeFile = () => false,
  ignoreDirs = DISCOVERY_IGNORED_DIRS
} = {}) {
  const found = [];

  async function walk(currentPath, depth) {
    if (depth > maxDepth || !(await statExists(currentPath))) return;

    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (ignoreDirs.has(entry.name)) continue;
        await walk(fullPath, depth + 1);
        continue;
      }

      if (entry.isFile() || entry.isSymbolicLink()) {
        if (includeFile(entry.name, fullPath)) {
          found.push(fullPath);
        }
      }
    }
  }

  await walk(rootPath, 0);
  return found;
}

function dedupeFilesByPath(entries) {
  const seen = new Set();
  const deduped = [];

  for (const entry of entries) {
    if (!entry?.path || seen.has(entry.path)) continue;
    seen.add(entry.path);
    deduped.push(entry);
  }

  return deduped;
}

function buildDiscoveredRuleFileEntry(filePath, { group = "Discovered Rule Files", scope = "Discovered rule" } = {}) {
  const fileName = path.basename(filePath);
  const spec = DISCOVERABLE_RULE_FILES.get(fileName);
  if (!spec) return null;

  return {
    id: buildEntryId("discovered-rule", filePath),
    group,
    label: `${scope}: ${compactDiscoveredPath(filePath)}`,
    path: filePath,
    cliTargets: spec.cliTargets,
    editable: true,
    discoveredType: "rule"
  };
}

function buildDiscoveredSkillFileEntry(filePath, {
  group = "Discovered Skill Files",
  scope = "Discovered skill",
  cliTargets = ["codex", "claude", "gemini", "opencode"]
} = {}) {
  const skillName = path.basename(path.dirname(filePath));

  return {
    id: buildEntryId("discovered-skill", filePath),
    group,
    label: `${scope}: ${skillName}`,
    path: filePath,
    cliTargets,
    editable: true,
    discoveredType: "skill"
  };
}

async function listExplicitRuleFiles() {
  const entries = [];
  const candidates = [
    { filePath: path.join(HOME, "AGENTS.md"), group: "Home Rule Files", scope: "Home rule" },
    ...Object.values(CLI_PROFILES).map((profile) => ({
      filePath: profile.homePath,
      group: "Home Rule Files",
      scope: `${profile.label} home`
    }))
  ];

  for (const candidate of candidates) {
    if (!(await statExists(candidate.filePath))) continue;
    const entry = buildDiscoveredRuleFileEntry(candidate.filePath, candidate);
    if (entry) entries.push(entry);
  }

  return entries;
}

async function listRepoRuleFiles() {
  const managedPaths = new Set(getManagedSourceFiles().map((file) => file.path));
  const repoRulePaths = await walkDiscoverableFiles(REPO_ROOT, {
    maxDepth: 4,
    includeFile: (name) => DISCOVERABLE_RULE_FILES.has(name)
  });

  return repoRulePaths
    .filter((filePath) => !managedPaths.has(filePath))
    .map((filePath) => buildDiscoveredRuleFileEntry(filePath, {
      group: "Repo Rule Files",
      scope: "Repo rule"
    }))
    .filter(Boolean);
}

async function listSkillFilesFromRoot(rootPath, {
  group,
  scope,
  cliTargets,
  maxDepth = 3
}) {
  if (!(await statExists(rootPath))) return [];

  const skillPaths = await walkDiscoverableFiles(rootPath, {
    maxDepth,
    includeFile: (name) => name === "SKILL.md"
  });

  return skillPaths.map((filePath) => buildDiscoveredSkillFileEntry(filePath, {
    group,
    scope,
    cliTargets
  }));
}

async function listDiscoveredRuleFiles() {
  return dedupeFilesByPath([
    ...(await listExplicitRuleFiles()),
    ...(await listRepoRuleFiles())
  ]);
}

async function listDiscoveredSkillFiles() {
  const sharedSkillTargets = ["codex", "gemini", "opencode"];

  return dedupeFilesByPath([
    ...(await listSkillFilesFromRoot(path.join(HOME, ".agents", "skills"), {
      group: "Shared Skill Files",
      scope: "Shared skill",
      cliTargets: sharedSkillTargets,
      maxDepth: 3
    })),
    ...(await listSkillFilesFromRoot(path.join(HOME, ".codex", "skills"), {
      group: "Codex Skill Files",
      scope: "Codex skill",
      cliTargets: ["codex"],
      maxDepth: 4
    })),
    ...(await listSkillFilesFromRoot(path.join(SUPERPOWERS_ROOT, "skills"), {
      group: "Superpowers Skill Files",
      scope: "Superpowers skill",
      cliTargets: ["codex", "gemini", "opencode"],
      maxDepth: 3
    }))
  ]);
}

function getManagedSourceFiles() {
  return [
    {
      id: "shared-baseline",
      group: "Instruction Sources",
      label: "Shared Baseline Policy",
      path: HUB_FILES.baselinePolicy,
      cliTargets: ["codex", "claude", "gemini", "opencode"],
      editable: true
    },
    ...Object.values(CLI_PROFILES).map((profile) => ({
      id: `${profile.id}-overlay`,
      group: "CLI Overlays",
      label: `${profile.label} Overlay`,
      path: profile.overlayPath,
      cliTargets: [profile.id],
      editable: true
    })),
    ...Object.values(CLI_PROFILES).map((profile) => ({
      id: `${profile.id}-generated`,
      group: "Generated Instructions",
      label: `${profile.label} Effective Instructions`,
      path: profile.generatedPath,
      cliTargets: [profile.id],
      editable: false
    })),
    ...Object.values(CLI_PROFILES)
      .filter((profile) => profile.runtimeConfigPath)
      .map((profile) => ({
        id: profile.runtimeConfigId || `${profile.id}-config`,
        group: "Local Runtime Configs",
        label: `${profile.label} Runtime Config`,
        path: profile.runtimeConfigPath,
        cliTargets: [profile.id],
        editable: true
      })),
    {
      id: "capability-bench",
      group: "Capability Bench",
      label: "Capability Test Bench",
      path: HUB_FILES.capabilityBench,
      cliTargets: ["codex", "claude", "gemini", "opencode"],
      editable: true
    },
    {
      id: "capability-matrix",
      group: "Docs",
      label: "Capability Matrix",
      path: HUB_FILES.capabilityMatrix,
      cliTargets: ["codex", "claude", "gemini", "opencode"],
      editable: true
    },
    {
      id: "hub-readme",
      group: "Docs",
      label: "Hub README",
      path: HUB_FILES.readme,
      cliTargets: ["codex", "claude", "gemini", "opencode"],
      editable: true
    }
  ];
}

export async function getManagedFiles() {
  return dedupeFilesByPath([
    ...getManagedSourceFiles(),
    ...(await listDiscoveredRuleFiles()),
    ...(await listDiscoveredSkillFiles())
  ]);
}

export function parseClaudePlugins(raw) {
  const plugins = [];
  let current = null;

  for (const line of raw.split(/\r?\n/)) {
    const pluginMatch = line.match(/^\s*❯\s+([^\s]+@[^\s]+)/);
    if (pluginMatch) {
      if (current) plugins.push(current);
      current = {
        name: pluginMatch[1],
        enabled: false,
        status: "unknown"
      };
      continue;
    }

    if (!current) continue;

    const statusMatch = line.match(/^\s*Status:\s*(.+)$/);
    if (statusMatch) {
      current.status = statusMatch[1].trim();
      current.enabled =
        /\benabled\b/i.test(current.status) &&
        !/\bdisabled\b/i.test(current.status);
    }
  }

  if (current) plugins.push(current);
  return plugins;
}

export function parseGeminiExtensions(raw) {
  const extensions = [];
  let current = null;

  for (const line of raw.split(/\r?\n/)) {
    const startMatch = line.match(/^[✓✗]\s+(.+?)\s+\(/);
    if (startMatch) {
      if (current) extensions.push(current);
      current = {
        name: startMatch[1].trim(),
        path: "",
        source: "",
        sourceType: "",
        enabledUser: false,
        enabledWorkspace: false,
        active: false
      };
      continue;
    }

    if (!current) continue;

    const pathMatch = line.match(/^\s*Path:\s*(.+)$/);
    if (pathMatch) {
      current.path = pathMatch[1].trim();
      continue;
    }

    const sourceMatch = line.match(/^\s*Source:\s*(.+?)\s+\(Type:\s*(.+?)\)\s*$/);
    if (sourceMatch) {
      current.source = sourceMatch[1].trim();
      current.sourceType = sourceMatch[2].trim();
      continue;
    }

    const userEnabledMatch = line.match(/^\s*Enabled \(User\):\s*(true|false)\s*$/i);
    if (userEnabledMatch) {
      current.enabledUser = userEnabledMatch[1].toLowerCase() === "true";
      current.active = current.enabledUser || current.enabledWorkspace;
      continue;
    }

    const workspaceEnabledMatch = line.match(/^\s*Enabled \(Workspace\):\s*(true|false)\s*$/i);
    if (workspaceEnabledMatch) {
      current.enabledWorkspace = workspaceEnabledMatch[1].toLowerCase() === "true";
      current.active = current.enabledUser || current.enabledWorkspace;
    }
  }

  if (current) extensions.push(current);
  return extensions;
}

function tagCapabilities(names) {
  return unique(
    names.flatMap((name) => KNOWN_CAPABILITIES[name] || [])
  );
}

function normalizeCodexOrchestratorMode(raw) {
  const value = String(raw || "").trim();
  return CODEX_ORCHESTRATOR_MODES.has(value) ? value : "custom";
}

export function evaluateProfileStatus(toolId, context) {
  if (toolId !== "codex" && !context.syncOk) {
    return {
      status: "detected",
      summary: "This CLI is detected, but its home path is not currently wired to the hub-managed instruction file.",
      details: [
        "The generated instruction file exists in the hub, but the live home-level path is not synced to it yet.",
        "This is a delivery-path difference, not proof that the CLI is unusable."
      ]
    };
  }

  switch (toolId) {
    case "codex": {
      const mode = context.codexOrchestratorMode || "superpowers-primary";

      if (!context.syncOk) {
        return {
          status: "detected",
          summary: "Codex is detected, but its instructions are not wired to the selected hub-managed orchestrator mode yet.",
          details: [
            mode === "omx-primary"
              ? "Run the Codex orchestrator action for OMX again to rewrite ~/.codex/AGENTS.md."
              : "Run bootstrap or switch the Codex orchestrator mode from Operations to restore the managed AGENTS path."
          ]
        };
      }

      if (mode === "omx-primary") {
        return {
          status: "managed",
          summary: "Codex is managed by the hub in OMX-primary mode.",
          details: [
            "OMX controls Codex orchestration through ~/.codex/AGENTS.md.",
            "Slash commands are optional shortcuts; natural-language steering still works."
          ]
        };
      }

      if (mode === "hybrid-tools-only") {
        return {
          status: "managed",
          summary: "Codex is managed by the hub in Hybrid tools-only mode.",
          details: [
            "Hub-managed superpowers AGENTS steering is primary.",
            "OMX tooling remains available for optional prompts, skills, and runtime helpers."
          ]
        };
      }

      const hasSuperpowers = context.globalSuperpowersVisible && context.codexSharedSkillRoots.includes("superpowers");
      if (!hasSuperpowers) {
        return {
          status: "detected",
          summary: "Codex is running without the optional shared superpowers skill path active.",
          details: [
            "The hub can still detect Codex rules and config, but the preferred shared workflow layer is not currently visible.",
            "This is a detected setup difference, not a hard requirement for using Codex."
          ]
        };
      }
      if (!context.codexSuperpowersManaged) {
        return {
          status: "detected",
          summary: "Codex can see a superpowers pack, but it does not resolve to the hub-managed checkout.",
          details: [
            "The workflow layer may still work, but this hub can no longer honestly claim control over that skill source."
          ]
        };
      }
      return {
        status: "managed",
        summary: "Codex is managed by the hub: generated instructions are synced and native superpowers discovery is active.",
        details: [
          "Codex can see the shared baseline, the Codex overlay, and the global superpowers skill pack.",
          "Built-in system skills remain available on top of the shared stack."
        ]
      };
    }
    case "claude": {
      const hasPlugin = context.claudePlugins.some((plugin) => plugin.includes("superpowers"));
      if (!hasPlugin) {
        return {
          status: "detected",
          summary: "Claude is detected, but no optional workflow plugin is currently active.",
          details: [
            "The hub can still inspect Claude's rule and settings files without requiring any specific external plugin.",
            "If a plugin is installed later, the dashboard will reflect it."
          ]
        };
      }
      if (!context.claudeSuperpowersActive) {
        return {
          status: "detected",
          summary: "Claude has a workflow plugin installed, but it is currently disabled or inactive.",
          details: [
            "The dashboard distinguishes plugin installation from actual enablement so users can see the real current state."
          ]
        };
      }
      return {
        status: "managed",
        summary: "Claude is managed by the hub: the synced overlay and optional workflow plugin are both active.",
        details: [
          "The instruction layer is hub-managed.",
          "The plugin payload comes from Claude's external plugin install, not from editable local skill files."
        ]
      };
    }
    case "gemini": {
      const hasExtension = context.geminiExtensions.includes("superpowers");
      if (!hasExtension) {
        return {
          status: "detected",
          summary: "Gemini is detected, but no optional linked workflow extension is currently active.",
          details: [
            "The hub can still inspect Gemini rule files and detected extension state without requiring a specific extension.",
            "If a linked extension is added later, the dashboard will reflect it."
          ]
        };
      }
      if (!context.geminiSuperpowersActive) {
        return {
          status: "detected",
          summary: "Gemini has a workflow extension installed, but it is disabled in the current scopes.",
          details: [
            "The dashboard distinguishes extension installation from actual enablement so users can see the real current state."
          ]
        };
      }
      if (!context.geminiSuperpowersManaged) {
        return {
          status: "detected",
          summary: "Gemini's superpowers extension is active, but it is not linked back to the hub-managed checkout.",
          details: [
            "The overlay is present, but local skill edits here are no longer guaranteed to change Gemini behavior."
          ]
        };
      }
      return {
        status: "managed",
        summary: "Gemini is managed by the hub: the synced overlay and linked workflow extension are active.",
        details: [
          "Gemini reads the same baseline policy, then layers the Gemini-specific overlay on top.",
          "Because the extension is linked from the local superpowers checkout, those skills are editable from this hub."
        ]
      };
    }
    case "opencode": {
      if (context.opencodeConfigError) {
        return {
          status: "broken",
          summary: "OpenCode config could not be parsed, so harness status is currently unreadable.",
          details: [
            `Config parse error: ${context.opencodeConfigError}`
          ]
        };
      }
      if (!context.opencodeInstructionsConfigured) {
        return {
          status: "detected",
          summary: "OpenCode is detected, but it is not currently pointed at the hub-managed instructions path.",
          details: [
            "The generated instructions file can exist and the home alias can resolve correctly while OpenCode still loads a different instructions list.",
            "This is a wiring difference the dashboard should show, not a reason to assume the user is wrong."
          ]
        };
      }
      if (!context.opencodeInstructionsHomeConfigured && context.opencodeInstructionsGeneratedConfigured) {
        return {
          status: "detected",
          summary: "OpenCode reads the generated instructions directly instead of the managed home-level alias.",
          details: [
            "This works, but it bypasses the intended delivery path documented by the hub."
          ]
        };
      }

      const hasOhMy = context.opencodePlugins.includes("oh-my-opencode");
      const hasSuperpowersPlugin = context.opencodePlugins.some((plugin) => plugin.includes("superpowers"));
      const hasOverlap = hasSuperpowersPlugin || context.globalSuperpowersVisible;

      if (!hasOhMy && !hasSuperpowersPlugin) {
        return {
          status: "detected",
          summary: "OpenCode is detected, but no optional harness plugin is currently enabled.",
          details: [
            "The local instructions can still render and sync, while harness capabilities remain an optional external layer.",
            "The dashboard should report that state without forcing a particular plugin choice."
          ]
        };
      }

      if (hasOhMy && hasOverlap) {
        return {
          status: "detected",
          summary: "OpenCode has harness overlap: oh-my-opencode is active alongside superpowers discovery or plugin wiring.",
          details: [
            "This is useful for labs, but it is not the clean single-harness default.",
            "Global superpowers visibility cannot be isolated to OpenCode only on this machine."
          ]
        };
      }

      if (hasSuperpowersPlugin && !hasOhMy) {
        return {
          status: "detected",
          summary: "OpenCode is running a superpowers-only profile. That works, but it is not the hub's preferred default.",
          details: [
            "The recommended OpenCode profile is oh-my-opencode by itself.",
            "Use this mode only if you intentionally want OpenCode to mirror the superpowers workflow stack."
          ]
        };
      }

      return {
        status: "managed",
        summary: "OpenCode is managed by the hub in the clean single-harness profile: oh-my-opencode without superpowers overlap.",
        details: [
          "This is the most predictable OpenCode setup the hub can represent today."
        ]
      };
    }
    default:
      return {
        status: "broken",
        summary: `Profile status evaluation for ${toolId} is not implemented.`,
        details: []
      };
  }
}

function buildInstructionStack(profile) {
  return [
    {
      order: 1,
      label: "Shared Baseline",
      path: HUB_FILES.baselinePolicy,
      editable: true
    },
    {
      order: 2,
      label: `${profile.label} Overlay`,
      path: profile.overlayPath,
      editable: true
    }
  ];
}

function buildSyncState(profile, resolvedPath, extraFacts = []) {
  const facts = [
    ["Generated", profile.generatedPath],
    ["Home path", profile.homeLabel],
    ["Resolved", resolvedPath || "(missing)"],
    ...extraFacts
  ];

  return {
    generatedPath: profile.generatedPath,
    homePath: profile.homePath,
    homeLabel: profile.homeLabel,
    resolvedPath: resolvedPath || "(missing)",
    syncOk: resolvedPath === profile.generatedPath,
    facts
  };
}

function buildRestartHints(toolId, syncState, context = {}) {
  const hints = [];

  if (!syncState.syncOk) {
    if (toolId === "codex" && context.codexOrchestratorMode === "omx-primary") {
      hints.push("Run the Codex Orchestrator OMX mode action again to restore OMX-managed AGENTS wiring.");
    } else {
      hints.push("Run Bootstrap once to repoint the home-level instruction path to the generated file.");
    }
  } else {
    if (toolId === "codex" && context.codexOrchestratorMode === "omx-primary") {
      hints.push("Restart the next Codex session to apply OMX AGENTS and runtime updates.");
    } else {
      hints.push("Restarting the next CLI session is enough after instruction edits, because the home path resolves into this repo.");
    }
  }

  if (toolId === "codex" && context.codexOrchestratorMode === "omx-primary") {
    hints.push("Start Codex with omx when you want OMX-first orchestration defaults.");
  }

  if (toolId === "claude") {
    hints.push("Claude plugin changes require a fresh Claude session.");
  }

  if (toolId === "gemini") {
    hints.push("Gemini extension changes can require restarting Gemini CLI.");
  }

  if (toolId === "opencode") {
    hints.push("OpenCode plugin or config changes require restarting OpenCode.");
  }

  return hints;
}

function buildConstraints(toolId) {
  switch (toolId) {
    case "codex":
      return [
        "Codex discovers user skills from ~/.agents/skills.",
        "That same global skill directory is also visible to OpenCode."
      ];
    case "claude":
      return [
        "Claude uses an external superpowers plugin install; local skill file edits do not rewrite that plugin payload."
      ];
    case "gemini":
      return [
        "Gemini uses a locally linked superpowers extension, so hub edits can affect the live extension content."
      ];
    case "opencode":
      return [
        "OpenCode plugin selection is centralized here, but harness internals are external packages.",
        "Global superpowers visibility is shared with Codex, so per-CLI isolation is limited."
      ];
    default:
      return [];
  }
}

function buildActiveSources(toolId, runtime) {
  const superpowersEntries = runtime.superpowersSkillNames;
  const discoveredRuleEntries = runtime.discoveredRuleFiles
    .filter((file) => file.cliTargets.includes(toolId))
    .map((file) => file.label);
  const discoveredSkillEntries = runtime.discoveredSkillFiles
    .filter((file) => file.cliTargets.includes(toolId))
    .map((file) => file.label);
  const discoverySources = [];

  if (discoveredRuleEntries.length) {
    discoverySources.push({
      label: "Discovered rule files",
      path: REPO_ROOT,
      entries: discoveredRuleEntries,
      managedByHub: false,
      note: "Auto-discovered from current repo and home-level CLI rule locations. Open them from Files to inspect or edit text-backed rules."
    });
  }

  if (discoveredSkillEntries.length) {
    discoverySources.push({
      label: "Discovered skill files",
      path: path.join(HOME, ".agents", "skills"),
      entries: discoveredSkillEntries,
      managedByHub: false,
      note: "Auto-discovered from shared, CLI-local, and managed superpowers skill roots. File-backed skill definitions are editable from Files."
    });
  }

  switch (toolId) {
    case "codex":
      return [
        {
          label: "Shared superpowers skills",
          path: path.join(HOME, ".agents", "skills", "superpowers"),
          entries: runtime.globalSuperpowersVisible ? superpowersEntries : [],
          managedByHub: runtime.codexSuperpowersManaged,
          note: runtime.codexOrchestratorMode === "omx-primary"
            ? "Optional while OMX is primary. This shared path still resolves to the hub-managed superpowers checkout."
            : !runtime.globalSuperpowersVisible
            ? "Global superpowers is currently hidden from the shared ~/.agents/skills path."
            : runtime.codexSuperpowersManaged
            ? "Active through Codex native skill discovery and resolved to the hub-managed superpowers checkout shared with OpenCode."
            : "Visible to Codex, but it does not resolve to the hub-managed superpowers checkout."
        },
        {
          label: "Codex system skills",
          path: path.join(HOME, ".codex", "skills", ".system"),
          entries: runtime.codexSystemSkills,
          managedByHub: false,
          note: "Built-in Codex skills remain available regardless of the hub."
        },
        ...discoverySources
      ];
    case "claude":
      return [
        {
          label: "Claude superpowers plugin",
          path: "superpowers@claude-plugins-official",
          entries: runtime.claudePluginRecords.map((plugin) => (
            plugin.enabled ? plugin.name : `${plugin.name} (disabled)`
          )),
          managedByHub: false,
          note: "Configured outside the hub; the overlay can steer into it, but the plugin payload is external."
        },
        ...discoverySources
      ];
    case "gemini":
      return [
        {
          label: "Gemini linked extensions",
          path: path.join(HOME, ".gemini", "extensions"),
          entries: runtime.geminiExtensionRecords.map((extension) => (
            extension.active ? extension.name : `${extension.name} (disabled)`
          )),
          managedByHub: runtime.geminiSuperpowersManaged,
          note: !runtime.geminiExtensions.includes("superpowers")
            ? "Gemini does not currently have a superpowers extension enabled."
            : !runtime.geminiSuperpowersActive
            ? "Gemini has a superpowers extension installed, but it is currently disabled in the active scopes."
            : runtime.geminiSuperpowersManaged
            ? "Gemini can read the locally linked superpowers extension from this machine."
            : "Gemini has a superpowers extension, but the hub could not verify that it links back to the local checkout."
        },
        ...discoverySources
      ];
    case "opencode":
      return [
        {
          label: "OpenCode plugin array",
          path: HUB_FILES.opencodeConfig,
          entries: runtime.opencodePlugins,
          managedByHub: true,
          note: "The hub controls plugin selection through guarded actions, but not the plugin package internals."
        },
        {
          label: "Global shared skills",
          path: path.join(HOME, ".agents", "skills", "superpowers"),
          entries: runtime.globalSuperpowersVisible ? superpowersEntries : [],
          managedByHub: runtime.codexSuperpowersManaged,
          note: !runtime.globalSuperpowersVisible
            ? "Global superpowers is currently hidden from ~/.agents/skills."
            : runtime.codexSuperpowersManaged
            ? "Optional shared discovery path resolved to the hub-managed superpowers checkout. If visible together with oh-my-opencode, the profile remains detected rather than hub-managed."
            : "Visible to OpenCode, but not verified as the hub-managed superpowers checkout."
        },
        ...discoverySources
      ];
    default:
      return [];
  }
}

function buildCapabilities(toolId, runtime) {
  switch (toolId) {
    case "codex":
      return tagCapabilities([
        ...(runtime.globalSuperpowersVisible ? ["superpowers"] : []),
        ...runtime.codexSystemSkills
      ]);
    case "claude":
      return tagCapabilities(runtime.claudeActivePlugins);
    case "gemini":
      return tagCapabilities(runtime.geminiActiveExtensions);
    case "opencode":
      return tagCapabilities([
        ...runtime.opencodePlugins,
        ...(runtime.globalSuperpowersVisible ? ["superpowers"] : [])
      ]);
    default:
      return [];
  }
}

async function readCapabilityBench() {
  const raw = await readFileSafe(HUB_FILES.capabilityBench);
  if (!raw.trim()) return { entries: [], error: null };

  try {
    return {
      entries: JSON.parse(raw),
      error: null
    };
  } catch (error) {
    return {
      entries: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function buildDashboardState() {
  const managedFiles = await getManagedFiles();
  const discoveredRuleFiles = managedFiles.filter((file) => file.discoveredType === "rule");
  const discoveredSkillFiles = managedFiles.filter((file) => file.discoveredType === "skill");
  const claudeSettingsRaw = await readFileSafe(HUB_FILES.claudeSettings);
  const claudeSettingsResult = parseOptionalJsonc(claudeSettingsRaw);
  const codexConfigRaw = await readFileSafe(HUB_FILES.codexConfig);
  const codexConfigResult = parseTomlConfig(codexConfigRaw);
  const opencodeConfigRaw = await readFileSafe(HUB_FILES.opencodeConfig);
  const opencodeConfigResult = parseJsonc(opencodeConfigRaw);
  const opencodeConfig = opencodeConfigResult.data;
  const runtimeConfigFactsByProfile = {
    claude: summarizeClaudeRuntimeConfig(claudeSettingsResult.data),
    codex: summarizeCodexRuntimeConfig(codexConfigResult.data),
    opencode: summarizeOpenCodeRuntimeConfig(opencodeConfig)
  };
  const opencodePlugins = Array.isArray(opencodeConfig.plugin) ? opencodeConfig.plugin : [];
  const opencodeDeliveryState = getOpencodeDeliveryState(opencodeConfig, {
    homePath: CLI_PROFILES.opencode.homePath,
    generatedPath: CLI_PROFILES.opencode.generatedPath
  });
  const claudePluginRecords = parseClaudePlugins(shell("claude", ["plugins", "list"]).combined);
  const geminiExtensionRecords = parseGeminiExtensions(shell("gemini", ["extensions", "list"]).combined);
  const claudePlugins = claudePluginRecords.map((plugin) => plugin.name);
  const claudeActivePlugins = claudePluginRecords.filter((plugin) => plugin.enabled).map((plugin) => plugin.name);
  const geminiExtensions = geminiExtensionRecords.map((extension) => extension.name);
  const geminiActiveExtensions = geminiExtensionRecords.filter((extension) => extension.active).map((extension) => extension.name);
  const codexSharedSkillRoots = await listDirNames(path.join(HOME, ".agents", "skills"));
  const codexSystemSkills = await listDirNames(path.join(HOME, ".codex", "skills", ".system"));
  const superpowersSkillNames = discoveredSkillFiles
    .filter((file) => file.group === "Superpowers Skill Files")
    .map((file) => path.basename(path.dirname(file.path)));
  const codexOrchestratorMode = normalizeCodexOrchestratorMode(
    shell("bash", [HUB_FILES.setCodexOrchestratorScript, "status"]).combined
  );
  const globalSuperpowersVisible = codexSharedSkillRoots.includes("superpowers");
  const codexSuperpowersResolved = await realpathSafe(path.join(HOME, ".agents", "skills", "superpowers"));
  const codexSuperpowersManaged = codexSuperpowersResolved === path.join(SUPERPOWERS_ROOT, "skills");
  const geminiSuperpowersEntry = geminiExtensionRecords.find((extension) => extension.name === "superpowers");
  const geminiSuperpowersActive = Boolean(geminiSuperpowersEntry?.active);
  const geminiSuperpowersManaged = Boolean(
    geminiSuperpowersEntry &&
    geminiSuperpowersEntry.sourceType === "link" &&
    path.normalize(geminiSuperpowersEntry.source) === path.normalize(SUPERPOWERS_ROOT)
  );
  const capabilityBenchResult = await readCapabilityBench();

  const runtime = {
    claudePluginRecords,
    claudePlugins,
    claudeActivePlugins,
    geminiExtensionRecords,
    geminiExtensions,
    geminiActiveExtensions,
    codexSharedSkillRoots,
    codexSystemSkills,
    opencodePlugins,
    superpowersSkillNames,
    codexOrchestratorMode,
    globalSuperpowersVisible,
    codexSuperpowersManaged,
    geminiSuperpowersActive,
    geminiSuperpowersManaged,
    discoveredRuleFiles,
    discoveredSkillFiles
  };

  const tools = [];
  for (const profile of Object.values(CLI_PROFILES)) {
    const resolvedPath = await realpathSafe(profile.homePath);
    const expectedCodexPath = codexOrchestratorMode === "omx-primary"
      ? resolvedPath
      : profile.generatedPath;
    const syncState = buildSyncState(
      profile,
      resolvedPath,
      [
        ...(profile.runtimeConfigLabel ? [["Runtime config", profile.runtimeConfigLabel]] : []),
        ...(profile.id === "codex"
          ? [["Orchestrator mode", codexOrchestratorMode]]
          : []),
        ...(runtimeConfigFactsByProfile[profile.id] || []),
        ...(profile.id === "opencode"
          ? [[
            "Config instructions",
            opencodeDeliveryState.configuredHomePath
              ? CLI_PROFILES.opencode.homePath
              : opencodeDeliveryState.configuredGeneratedPath
              ? CLI_PROFILES.opencode.generatedPath
              : "(missing managed path)"
          ]]
          : [])
      ]
    );
    if (profile.id === "codex") {
      syncState.syncOk = Boolean(resolvedPath) && (
        codexOrchestratorMode === "omx-primary"
          ? true
          : resolvedPath === expectedCodexPath
      );
    }

    const profileStatus = evaluateProfileStatus(profile.id, {
      syncOk: syncState.syncOk,
      codexOrchestratorMode,
      globalSuperpowersVisible,
      codexSuperpowersManaged,
      geminiSuperpowersManaged,
      claudeSuperpowersActive: claudePluginRecords.some((plugin) => plugin.name.includes("superpowers") && plugin.enabled),
      geminiSuperpowersActive,
      opencodeInstructionsConfigured: opencodeDeliveryState.configured,
      opencodeInstructionsHomeConfigured: opencodeDeliveryState.configuredHomePath,
      opencodeInstructionsGeneratedConfigured: opencodeDeliveryState.configuredGeneratedPath,
      opencodeConfigError: opencodeConfigResult.error,
      claudePlugins,
      geminiExtensions,
      codexSharedSkillRoots,
      opencodePlugins
    });

    tools.push({
      id: profile.id,
      label: profile.label,
      preferredProfile: profile.preferredProfile,
      instructionStack: buildInstructionStack(profile),
      syncState,
      profileStatus,
      activeSources: buildActiveSources(profile.id, runtime),
      capabilities: buildCapabilities(profile.id, runtime),
      constraints: buildConstraints(profile.id),
      restartHints: buildRestartHints(profile.id, syncState, { codexOrchestratorMode }),
      managedFiles: managedFiles.filter((file) => file.cliTargets.includes(profile.id))
    });
  }

  const warnings = tools
    .filter((tool) => tool.profileStatus.status === "broken")
    .map((tool) => `${tool.label}: ${tool.profileStatus.summary}`);

  if (opencodeConfigResult.error) {
    warnings.push(`OpenCode config parse error: ${opencodeConfigResult.error}`);
  }

  if (claudeSettingsResult.error) {
    warnings.push(`Claude runtime config parse error: ${claudeSettingsResult.error}`);
  }

  if (capabilityBenchResult.error) {
    warnings.push(`Capability bench parse error: ${capabilityBenchResult.error}`);
  }

  return {
    generatedAt: new Date().toISOString(),
    repoRoot: REPO_ROOT,
    superpowersRoot: SUPERPOWERS_ROOT,
    codexOrchestratorMode,
    globalSuperpowersVisibility: globalSuperpowersVisible ? "on" : "off",
    discoverySummary: {
      rules: discoveredRuleFiles.length,
      skills: discoveredSkillFiles.length
    },
    warnings,
    managedFiles,
    tools,
    capabilityBench: capabilityBenchResult.entries
  };
}
