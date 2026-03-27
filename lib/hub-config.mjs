import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const REPO_ROOT = path.resolve(__dirname, "..");
export const GENERATED_ROOT = path.join(REPO_ROOT, "generated");
export const HOME = os.homedir();
export const DEFAULT_XDG_CONFIG_HOME = path.join(HOME, ".config");
export const DEFAULT_WORKSPACE_ROOT = path.join(HOME, "workspace");

function resolveConfiguredPath(value) {
  if (!value) return "";
  return path.resolve(value);
}

export function resolveXdgConfigHome({
  home = HOME,
  env = process.env
} = {}) {
  return resolveConfiguredPath(env.XDG_CONFIG_HOME) || path.join(home, ".config");
}

export function resolveWorkspaceRoot({
  home = HOME,
  env = process.env
} = {}) {
  return resolveConfiguredPath(env.WORKSPACE_ROOT) || path.join(home, "workspace");
}

export function resolveSuperpowersRoot({
  repoRoot = REPO_ROOT,
  home = HOME,
  workspaceRoot = "",
  env = process.env,
  existsSync = fs.existsSync,
  realpathSync = fs.realpathSync
} = {}) {
  const effectiveWorkspaceRoot = workspaceRoot || resolveWorkspaceRoot({ home, env });
  const envRoot = resolveConfiguredPath(env.SUPERPOWERS_ROOT);
  if (envRoot && existsSync(envRoot)) {
    return envRoot;
  }

  const sharedSkillLink = path.join(home, ".agents", "skills", "superpowers");
  try {
    const resolvedSharedSkills = realpathSync(sharedSkillLink);
    const linkedRoot = path.basename(resolvedSharedSkills) === "skills"
      ? path.dirname(resolvedSharedSkills)
      : resolvedSharedSkills;
    if (existsSync(path.join(linkedRoot, "skills"))) {
      return linkedRoot;
    }
  } catch {
    // Fall through to the conventional checkout path.
  }

  const repoSiblingRoot = path.resolve(repoRoot, "../superpowers");
  if (existsSync(repoSiblingRoot)) {
    return repoSiblingRoot;
  }

  const conventionalRoots = [
    path.join(effectiveWorkspaceRoot, "superpowers"),
    path.join(home, "workspace", "superpowers")
  ];

  for (const conventionalRoot of conventionalRoots) {
    if (existsSync(conventionalRoot)) {
      return conventionalRoot;
    }
  }

  return path.join(effectiveWorkspaceRoot, "superpowers");
}

export const XDG_CONFIG_HOME = resolveXdgConfigHome();
export const WORKSPACE_ROOT = resolveWorkspaceRoot();
export const SUPERPOWERS_ROOT = resolveSuperpowersRoot();

export const HUB_FILES = {
  readme: path.join(REPO_ROOT, "README.md"),
  capabilityMatrix: path.join(REPO_ROOT, "docs", "capability-matrix.md"),
  capabilityBench: path.join(REPO_ROOT, "docs", "capability-test-bench.json"),
  baselinePolicy: path.join(REPO_ROOT, "shared", "baseline-policy.md"),
  claudeSettings: path.join(HOME, ".claude", "settings.json"),
  codexConfig: path.join(HOME, ".codex", "config.toml"),
  opencodeConfig: path.join(XDG_CONFIG_HOME, "opencode", "opencode.jsonc"),
  bootstrapScript: path.join(REPO_ROOT, "scripts", "bootstrap-home.sh"),
  renderInstructionsScript: path.join(REPO_ROOT, "scripts", "render-instructions.mjs"),
  updateOpencodeConfigScript: path.join(REPO_ROOT, "scripts", "update-opencode-config.mjs"),
  setOpencodePluginScript: path.join(REPO_ROOT, "scripts", "set-opencode-plugin.sh"),
  setGlobalSuperpowersVisibilityScript: path.join(REPO_ROOT, "scripts", "set-global-superpowers-visibility.sh"),
  setCodexOrchestratorScript: path.join(REPO_ROOT, "scripts", "set-codex-orchestrator.sh")
};

export const CLI_PROFILES = {
  codex: {
    id: "codex",
    label: "Codex",
    overlayPath: path.join(REPO_ROOT, "shared", "overlays", "codex.md"),
    generatedPath: path.join(GENERATED_ROOT, "codex", "AGENTS.md"),
    homePath: path.join(HOME, ".codex", "AGENTS.md"),
    homeLabel: "~/.codex/AGENTS.md",
    runtimeConfigId: "codex-config",
    runtimeConfigPath: path.join(HOME, ".codex", "config.toml"),
    runtimeConfigLabel: "~/.codex/config.toml",
    preferredProfile: "Shared baseline + Codex overlay + global superpowers discovery"
  },
  claude: {
    id: "claude",
    label: "Claude Code",
    overlayPath: path.join(REPO_ROOT, "shared", "overlays", "claude.md"),
    generatedPath: path.join(GENERATED_ROOT, "claude", "CLAUDE.md"),
    homePath: path.join(HOME, ".claude", "CLAUDE.md"),
    homeLabel: "~/.claude/CLAUDE.md",
    runtimeConfigId: "claude-settings",
    runtimeConfigPath: path.join(HOME, ".claude", "settings.json"),
    runtimeConfigLabel: "~/.claude/settings.json",
    preferredProfile: "Shared baseline + Claude overlay + superpowers Claude plugin"
  },
  gemini: {
    id: "gemini",
    label: "Gemini CLI",
    overlayPath: path.join(REPO_ROOT, "shared", "overlays", "gemini.md"),
    generatedPath: path.join(GENERATED_ROOT, "gemini", "GEMINI.md"),
    homePath: path.join(HOME, ".gemini", "GEMINI.md"),
    homeLabel: "~/.gemini/GEMINI.md",
    preferredProfile: "Shared baseline + Gemini overlay + linked superpowers extension"
  },
  opencode: {
    id: "opencode",
    label: "OpenCode",
    overlayPath: path.join(REPO_ROOT, "shared", "overlays", "opencode.md"),
    generatedPath: path.join(GENERATED_ROOT, "opencode", "default-instructions.md"),
    homePath: path.join(XDG_CONFIG_HOME, "opencode", "default-instructions.md"),
    homeLabel: XDG_CONFIG_HOME === DEFAULT_XDG_CONFIG_HOME
      ? "~/.config/opencode/default-instructions.md"
      : path.join(XDG_CONFIG_HOME, "opencode", "default-instructions.md"),
    runtimeConfigId: "opencode-config",
    runtimeConfigPath: path.join(XDG_CONFIG_HOME, "opencode", "opencode.jsonc"),
    runtimeConfigLabel: XDG_CONFIG_HOME === DEFAULT_XDG_CONFIG_HOME
      ? "~/.config/opencode/opencode.jsonc"
      : path.join(XDG_CONFIG_HOME, "opencode", "opencode.jsonc"),
    preferredProfile: "Shared baseline + OpenCode overlay + oh-my-opencode only"
  }
};

export const KNOWN_CAPABILITIES = {
  superpowers: [
    "Brainstorming workflow",
    "Writing plans",
    "TDD discipline",
    "Systematic debugging",
    "Review and verification loops",
    "Parallel agent orchestration"
  ],
  "superpowers@claude-plugins-official": [
    "Workflow-triggered planning",
    "Plugin-based superpowers stack",
    "Claude-native superpowers execution"
  ],
  "oh-my-opencode": [
    "Ultrawork harness",
    "Background agents",
    "frontend-ui-ux skill",
    "Built-in MCP stack",
    "LSP and AST helpers",
    "Tmux integration"
  ],
  "openai-docs": [
    "Official OpenAI docs lookup"
  ],
  "skill-creator": [
    "Skill authoring guidance"
  ],
  "skill-installer": [
    "Codex skill installation guidance"
  ]
};
