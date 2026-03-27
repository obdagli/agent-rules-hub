import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import fsSync from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import { composeManagedInstruction } from "../lib/instructions.mjs";
import { resolveSuperpowersRoot } from "../lib/hub-config.mjs";
import { buildDashboardState, evaluateProfileStatus, getManagedFiles, parseClaudePlugins, parseGeminiExtensions } from "../lib/state.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

async function symlinkFile(targetPath, linkPath) {
  await fs.mkdir(path.dirname(linkPath), { recursive: true });
  await fs.symlink(targetPath, linkPath);
}

async function writeExecutable(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
  await fs.chmod(filePath, 0o755);
}

async function makeFakeDashboardHome() {
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "agent-rules-hub-"));
  const binDir = path.join(tempHome, "bin");
  const superpowersRoot = path.join(tempHome, "workspace", "superpowers");

  await fs.mkdir(path.join(superpowersRoot, "skills", "demo-superpowers-skill"), { recursive: true });
  await fs.writeFile(path.join(superpowersRoot, "skills", "demo-superpowers-skill", "SKILL.md"), "# demo\n", "utf8");
  await fs.mkdir(path.join(tempHome, ".agents", "skills", "custom-shared-skill"), { recursive: true });
  await fs.writeFile(path.join(tempHome, ".agents", "skills", "custom-shared-skill", "SKILL.md"), "# shared\n", "utf8");
  await fs.mkdir(path.join(tempHome, ".codex", "skills", "custom-codex-skill"), { recursive: true });
  await fs.writeFile(path.join(tempHome, ".codex", "skills", "custom-codex-skill", "SKILL.md"), "# codex\n", "utf8");

  await symlinkFile(path.join(REPO_ROOT, "generated", "codex", "AGENTS.md"), path.join(tempHome, ".codex", "AGENTS.md"));
  await symlinkFile(path.join(REPO_ROOT, "generated", "claude", "CLAUDE.md"), path.join(tempHome, ".claude", "CLAUDE.md"));
  await symlinkFile(path.join(REPO_ROOT, "generated", "gemini", "GEMINI.md"), path.join(tempHome, ".gemini", "GEMINI.md"));
  await symlinkFile(
    path.join(REPO_ROOT, "generated", "opencode", "default-instructions.md"),
    path.join(tempHome, ".config", "opencode", "default-instructions.md")
  );
  await symlinkFile(path.join(superpowersRoot, "skills"), path.join(tempHome, ".agents", "skills", "superpowers"));

  await fs.writeFile(
    path.join(tempHome, ".config", "opencode", "opencode.jsonc"),
    `{
  "plugin": ["oh-my-opencode"],
  "instructions": ["${path.join(tempHome, ".config", "opencode", "default-instructions.md")}"]
}
`,
    "utf8"
  );

  await writeExecutable(
    path.join(binDir, "claude"),
    `#!/usr/bin/env bash
if [[ "$1" == "plugins" && "$2" == "list" ]]; then
  cat <<'EOF'
Installed plugins:

  ❯ superpowers@claude-plugins-official
    Version: 5.0.5
    Scope: user
    Status: ✓ enabled
EOF
  exit 0
fi
exit 1
`
  );

  await writeExecutable(
    path.join(binDir, "gemini"),
    `#!/usr/bin/env bash
if [[ "$1" == "extensions" && "$2" == "list" ]]; then
  cat <<'EOF'
Loaded cached credentials.
✓ superpowers (5.0.0)
 ID: abc
 Path: ${superpowersRoot}
 Source: ${superpowersRoot} (Type: link)
 Enabled (User): false
 Enabled (Workspace): true
EOF
  exit 0
fi
exit 1
`
  );

  return { tempHome, binDir, superpowersRoot };
}

test("resolveSuperpowersRoot falls back to the shared skill symlink target when repo sibling path is missing", async () => {
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "agent-rules-hub-root-"));
  const linkedRoot = path.join(tempHome, "workspace", "superpowers");
  const fakeWorktree = path.join(tempHome, ".config", "superpowers", "worktrees", "agent-rules-hub", "feature");

  try {
    await fs.mkdir(path.join(linkedRoot, "skills"), { recursive: true });
    await fs.mkdir(fakeWorktree, { recursive: true });
    await symlinkFile(path.join(linkedRoot, "skills"), path.join(tempHome, ".agents", "skills", "superpowers"));

    const resolved = resolveSuperpowersRoot({
      repoRoot: fakeWorktree,
      home: tempHome,
      env: {},
      existsSync: fsSync.existsSync,
      realpathSync: fsSync.realpathSync
    });

    assert.equal(resolved, linkedRoot);
  } finally {
    await fs.rm(tempHome, { recursive: true, force: true });
  }
});

test("composeManagedInstruction renders baseline and overlay provenance", () => {
  const output = composeManagedInstruction({
    toolId: "codex",
    toolLabel: "Codex",
    baselinePath: "/repo/shared/baseline-policy.md",
    overlayPath: "/repo/shared/overlays/codex.md",
    baselineContent: "# Shared Baseline\n\nShared policy body.\n",
    overlayContent: "# Codex Overlay\n\nCodex-specific policy.\n"
  });

  assert.match(output, /GENERATED FILE/);
  assert.match(output, /shared\/baseline-policy\.md/);
  assert.match(output, /shared\/overlays\/codex\.md/);
  assert.match(output, /# Shared Baseline/);
  assert.match(output, /# Codex Overlay/);
});

test("evaluateProfileStatus marks OpenCode overlap as detected", () => {
  const status = evaluateProfileStatus("opencode", {
    syncOk: true,
    globalSuperpowersVisible: true,
    codexSuperpowersManaged: true,
    opencodeInstructionsConfigured: true,
    claudePlugins: [],
    geminiExtensions: [],
    codexSharedSkillRoots: ["superpowers"],
    opencodePlugins: ["oh-my-opencode"]
  });

  assert.equal(status.status, "detected");
  assert.match(status.summary, /overlap/i);
});

test("evaluateProfileStatus marks Codex without shared superpowers as detected", () => {
  const status = evaluateProfileStatus("codex", {
    syncOk: true,
    codexOrchestratorMode: "superpowers-primary",
    globalSuperpowersVisible: false,
    codexSuperpowersManaged: false,
    opencodeInstructionsConfigured: true,
    claudePlugins: [],
    geminiExtensions: [],
    codexSharedSkillRoots: [],
    opencodePlugins: []
  });

  assert.equal(status.status, "detected");
  assert.match(status.summary, /superpowers/i);
});

test("evaluateProfileStatus marks Codex OMX-primary mode as managed without shared superpowers", () => {
  const status = evaluateProfileStatus("codex", {
    syncOk: true,
    codexOrchestratorMode: "omx-primary",
    globalSuperpowersVisible: false,
    codexSuperpowersManaged: false,
    opencodeInstructionsConfigured: true,
    claudePlugins: [],
    geminiExtensions: [],
    codexSharedSkillRoots: [],
    opencodePlugins: []
  });

  assert.equal(status.status, "managed");
  assert.match(status.summary, /omx|primary|managed|active/i);
});

test("evaluateProfileStatus marks Claude with plugin and synced policy as managed", () => {
  const status = evaluateProfileStatus("claude", {
    syncOk: true,
    globalSuperpowersVisible: true,
    codexSuperpowersManaged: true,
    claudePlugins: ["superpowers@claude-plugins-official"],
    claudeSuperpowersActive: true,
    geminiExtensions: [],
    codexSharedSkillRoots: ["superpowers"],
    opencodePlugins: []
  });

  assert.equal(status.status, "managed");
  assert.match(status.summary, /managed|ready|active/i);
});

test("evaluateProfileStatus marks Codex with unmanaged superpowers as detected", () => {
  const status = evaluateProfileStatus("codex", {
    syncOk: true,
    globalSuperpowersVisible: true,
    codexSuperpowersManaged: false,
    opencodeInstructionsConfigured: true,
    claudePlugins: [],
    geminiExtensions: [],
    codexSharedSkillRoots: ["superpowers"],
    opencodePlugins: []
  });

  assert.equal(status.status, "detected");
  assert.match(status.summary, /managed|checkout|control/i);
});

test("evaluateProfileStatus marks Gemini with unmanaged linked source as detected", () => {
  const status = evaluateProfileStatus("gemini", {
    syncOk: true,
    globalSuperpowersVisible: true,
    codexSuperpowersManaged: true,
    geminiSuperpowersManaged: false,
    geminiSuperpowersActive: true,
    opencodeInstructionsConfigured: true,
    claudePlugins: [],
    geminiExtensions: ["superpowers"],
    codexSharedSkillRoots: ["superpowers"],
    opencodePlugins: []
  });

  assert.equal(status.status, "detected");
  assert.match(status.summary, /linked|checkout|editable/i);
});

test("evaluateProfileStatus marks OpenCode without managed instructions as detected", () => {
  const status = evaluateProfileStatus("opencode", {
    syncOk: true,
    globalSuperpowersVisible: false,
    codexSuperpowersManaged: false,
    opencodeInstructionsConfigured: false,
    claudePlugins: [],
    geminiExtensions: [],
    codexSharedSkillRoots: [],
    opencodePlugins: ["oh-my-opencode"]
  });

  assert.equal(status.status, "detected");
  assert.match(status.summary, /instructions/i);
});

test("evaluateProfileStatus marks Claude plugin disabled state as detected", () => {
  const status = evaluateProfileStatus("claude", {
    syncOk: true,
    globalSuperpowersVisible: true,
    codexSuperpowersManaged: true,
    claudePlugins: ["superpowers@claude-plugins-official"],
    claudeSuperpowersActive: false,
    opencodeInstructionsConfigured: true,
    geminiExtensions: [],
    codexSharedSkillRoots: ["superpowers"],
    opencodePlugins: []
  });

  assert.equal(status.status, "detected");
  assert.match(status.summary, /disabled|inactive/i);
});

test("evaluateProfileStatus marks Gemini extension disabled state as detected", () => {
  const status = evaluateProfileStatus("gemini", {
    syncOk: true,
    globalSuperpowersVisible: true,
    codexSuperpowersManaged: true,
    geminiSuperpowersManaged: true,
    geminiSuperpowersActive: false,
    opencodeInstructionsConfigured: true,
    claudePlugins: [],
    geminiExtensions: ["superpowers"],
    codexSharedSkillRoots: ["superpowers"],
    opencodePlugins: []
  });

  assert.equal(status.status, "detected");
  assert.match(status.summary, /disabled|inactive/i);
});

test("parseClaudePlugins captures enablement state", () => {
  const plugins = parseClaudePlugins(`Installed plugins:

  ❯ superpowers@claude-plugins-official
    Version: 5.0.5
    Scope: user
    Status: ✖ disabled
`);

  assert.deepEqual(plugins, [
    {
      name: "superpowers@claude-plugins-official",
      enabled: false,
      status: "✖ disabled"
    }
  ]);
});

test("parseGeminiExtensions captures paths and active state", () => {
  const extensions = parseGeminiExtensions(`Loaded cached credentials.
✓ superpowers (5.0.0)
 ID: abc
 Path: /tmp/superpowers
 Source: /tmp/superpowers (Type: link)
 Enabled (User): false
 Enabled (Workspace): true
`);

  assert.deepEqual(extensions, [
    {
      name: "superpowers",
      path: "/tmp/superpowers",
      source: "/tmp/superpowers",
      sourceType: "link",
      enabledUser: false,
      enabledWorkspace: true,
      active: true
    }
  ]);
});

test("managed files include runtime config files for Codex, Claude, and OpenCode", async () => {
  const managedFiles = await getManagedFiles();
  assert.equal(managedFiles.some((file) => file.id === "claude-settings"), true);
  assert.equal(managedFiles.some((file) => file.id === "codex-config"), true);
  assert.equal(managedFiles.some((file) => file.id === "opencode-config"), true);
});

test("buildDashboardState exposes safe runtime config summaries for Codex, Claude, and OpenCode", async () => {
  const { tempHome, binDir } = await makeFakeDashboardHome();
  await fs.writeFile(
    path.join(tempHome, ".claude", "settings.json"),
    `{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:8317",
    "ANTHROPIC_API_KEY": "local-dev-key",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "gpt-5.4",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "gpt-5.3-codex",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "gpt-5.3-codex",
    "CLAUDE_CODE_SUBAGENT_MODEL": "gpt-5.3-codex"
  },
  "model": "opus[1m]"
}
`,
    "utf8"
  );
  await fs.writeFile(
    path.join(tempHome, ".codex", "config.toml"),
    `model = "gpt-5.4"
model_provider = "cliproxyapi"
reasoning_effort = "high"
model_reasoning_effort = "xhigh"
plan_mode_reasoning_effort = "xhigh"

[model_providers.cliproxyapi]
base_url = "http://127.0.0.1:8317/v1"
experimental_bearer_token = "local-dev-key"

[features]
multi_agent = true
`,
    "utf8"
  );
  await fs.writeFile(
    path.join(tempHome, ".config", "opencode", "opencode.jsonc"),
    `{
  "default_agent": "gpt-coder",
  "model": "openai/gpt-5.4",
  "small_model": "openai/gpt-5.3-codex",
  "plugin": ["oh-my-opencode"],
  "instructions": ["${path.join(tempHome, ".config", "opencode", "default-instructions.md")}"]
}
`,
    "utf8"
  );

  const probeScript = `
    import { buildDashboardState } from ${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, "lib", "state.mjs")).href)};
    const state = await buildDashboardState();
    const pick = (toolId) => {
      const tool = state.tools.find((entry) => entry.id === toolId);
      return {
        id: tool.id,
        facts: tool.syncState.facts,
        managedFileIds: tool.managedFiles.map((file) => file.id)
      };
    };
    console.log(JSON.stringify([pick("claude"), pick("codex"), pick("opencode")]));
  `;

  try {
    const probe = spawnSync(process.execPath, ["--input-type=module", "-e", probeScript], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: tempHome,
        XDG_CONFIG_HOME: path.join(tempHome, ".config"),
        PATH: `${binDir}:${process.env.PATH}`
      }
    });

    assert.equal(probe.status, 0, probe.stderr || probe.stdout);
    const payload = JSON.parse(probe.stdout.trim());
    const claude = payload.find((entry) => entry.id === "claude");
    const codex = payload.find((entry) => entry.id === "codex");
    const opencode = payload.find((entry) => entry.id === "opencode");
    const claudeFacts = Object.fromEntries(claude.facts);
    const codexFacts = Object.fromEntries(codex.facts);
    const opencodeFacts = Object.fromEntries(opencode.facts);

    assert.equal(claude.managedFileIds.includes("claude-settings"), true);
    assert.equal(codex.managedFileIds.includes("codex-config"), true);
    assert.equal(opencode.managedFileIds.includes("opencode-config"), true);
    assert.equal(claudeFacts["Runtime config"], "~/.claude/settings.json");
    assert.equal(claudeFacts.Gateway, "http://127.0.0.1:8317");
    assert.equal(claudeFacts["Selected model"], "opus[1m]");
    assert.equal(claudeFacts["Opus target"], "gpt-5.4");
    assert.equal(claudeFacts["Subagent model"], "gpt-5.3-codex");
    assert.equal(JSON.stringify(claude.facts).includes("local-dev-key"), false);

    assert.equal(codexFacts["Runtime config"], "~/.codex/config.toml");
    assert.equal(codexFacts.Provider, "cliproxyapi");
    assert.equal(codexFacts.Gateway, "http://127.0.0.1:8317/v1");
    assert.equal(codexFacts.Model, "gpt-5.4");
    assert.equal(codexFacts["Model reasoning"], "xhigh");
    assert.equal(codexFacts["Plan reasoning"], "xhigh");
    assert.equal(codexFacts["Multi-agent"], "on");
    assert.equal(JSON.stringify(codex.facts).includes("local-dev-key"), false);

    assert.equal(opencodeFacts["Runtime config"], "~/.config/opencode/opencode.jsonc");
    assert.equal(opencodeFacts["Default agent"], "gpt-coder");
    assert.equal(opencodeFacts.Model, "openai/gpt-5.4");
    assert.equal(opencodeFacts["Small model"], "openai/gpt-5.3-codex");
    assert.equal(opencodeFacts.Plugins, "oh-my-opencode");
  } finally {
    await fs.rm(tempHome, { recursive: true, force: true });
  }
});

test("buildDashboardState keeps Gemini source notes aligned with the managed active extension state", async () => {
  const { tempHome, binDir } = await makeFakeDashboardHome();
  const probeScript = `
    import { buildDashboardState } from ${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, "lib", "state.mjs")).href)};
    const state = await buildDashboardState();
    const gemini = state.tools.find((tool) => tool.id === "gemini");
    const source = gemini.activeSources.find((entry) => entry.label === "Gemini linked extensions");
    console.log(JSON.stringify({
      status: gemini.profileStatus.status,
      summary: gemini.profileStatus.summary,
      note: source.note
    }));
  `;

  try {
    const probe = spawnSync(process.execPath, ["--input-type=module", "-e", probeScript], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: tempHome,
        XDG_CONFIG_HOME: path.join(tempHome, ".config"),
        PATH: `${binDir}:${process.env.PATH}`
      }
    });

    assert.equal(probe.status, 0, probe.stderr || probe.stdout);
    const payload = JSON.parse(probe.stdout.trim());
    assert.equal(payload.status, "managed");
    assert.doesNotMatch(payload.note, /disabled in the active scopes/i);
    assert.match(payload.note, /locally linked superpowers extension|read the locally linked/i);
  } finally {
    await fs.rm(tempHome, { recursive: true, force: true });
  }
});

test("buildDashboardState marks Codex shared skills as hub-managed when the live symlink points at the managed checkout", async () => {
  const { tempHome, binDir, superpowersRoot } = await makeFakeDashboardHome();
  const probeScript = `
    import { buildDashboardState } from ${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, "lib", "state.mjs")).href)};
    const state = await buildDashboardState();
    const codex = state.tools.find((tool) => tool.id === "codex");
    const source = codex.activeSources.find((entry) => entry.label === "Shared superpowers skills");
    console.log(JSON.stringify({
      superpowersRoot: state.superpowersRoot,
      managedByHub: source.managedByHub,
      note: source.note
    }));
  `;

  try {
    const probe = spawnSync(process.execPath, ["--input-type=module", "-e", probeScript], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: tempHome,
        XDG_CONFIG_HOME: path.join(tempHome, ".config"),
        PATH: `${binDir}:${process.env.PATH}`
      }
    });

    assert.equal(probe.status, 0, probe.stderr || probe.stdout);
    const payload = JSON.parse(probe.stdout.trim());
    assert.equal(payload.superpowersRoot, superpowersRoot);
    assert.equal(payload.managedByHub, true);
    assert.match(payload.note, /hub-managed|managed checkout|read from the hub/i);
  } finally {
    await fs.rm(tempHome, { recursive: true, force: true });
  }
});

test("buildDashboardState discovers repo-local rule files and skill files for editing", async () => {
  const { tempHome, binDir } = await makeFakeDashboardHome();
  const fixtureRoot = path.join(REPO_ROOT, ".tmp-dashboard-introspection");
  const repoRulePath = path.join(fixtureRoot, "nested-project", "AGENTS.md");

  try {
    await fs.mkdir(path.dirname(repoRulePath), { recursive: true });
    await fs.writeFile(repoRulePath, "# nested repo rule\n", "utf8");

    const probeScript = `
      import { buildDashboardState } from ${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, "lib", "state.mjs")).href)};
      const state = await buildDashboardState();
      const codex = state.tools.find((tool) => tool.id === "codex");
      const claude = state.tools.find((tool) => tool.id === "claude");
      console.log(JSON.stringify({
        discoverySummary: state.discoverySummary,
        discoveredRulePaths: state.managedFiles.filter((file) => file.discoveredType === "rule").map((file) => file.path),
        discoveredSkillPaths: state.managedFiles.filter((file) => file.discoveredType === "skill").map((file) => file.path),
        codexSourceLabels: codex.activeSources.map((entry) => entry.label),
        claudeSourceLabels: claude.activeSources.map((entry) => entry.label),
        codexDiscoveredEntries: codex.activeSources.find((entry) => entry.label === "Discovered skill files")?.entries || []
      }));
    `;

    const probe = spawnSync(process.execPath, ["--input-type=module", "-e", probeScript], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: tempHome,
        XDG_CONFIG_HOME: path.join(tempHome, ".config"),
        PATH: `${binDir}:${process.env.PATH}`
      }
    });

    assert.equal(probe.status, 0, probe.stderr || probe.stdout);
    const payload = JSON.parse(probe.stdout.trim());

    assert.equal(payload.discoverySummary.rules > 0, true);
    assert.equal(payload.discoverySummary.skills > 0, true);
    assert.equal(payload.discoveredRulePaths.includes(repoRulePath), true);
    assert.equal(
      payload.discoveredSkillPaths.some((filePath) => filePath.endsWith(path.join("custom-shared-skill", "SKILL.md"))),
      true
    );
    assert.equal(
      payload.discoveredSkillPaths.some((filePath) => filePath.endsWith(path.join("custom-codex-skill", "SKILL.md"))),
      true
    );
    assert.equal(payload.codexSourceLabels.includes("Discovered rule files"), true);
    assert.equal(payload.codexSourceLabels.includes("Discovered skill files"), true);
    assert.equal(payload.claudeSourceLabels.includes("Discovered rule files"), true);
    assert.equal(
      payload.codexDiscoveredEntries.some((entry) => entry.includes("custom-codex-skill") || entry.includes("custom-shared-skill")),
      true
    );
  } finally {
    await fs.rm(fixtureRoot, { recursive: true, force: true });
    await fs.rm(tempHome, { recursive: true, force: true });
  }
});
