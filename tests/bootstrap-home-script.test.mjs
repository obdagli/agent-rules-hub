import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

async function writeExecutable(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
  await fs.chmod(filePath, 0o755);
}

async function makeSymlinkedRepoClone() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-rules-hub-bootstrap-"));
  const clonePath = path.join(tempRoot, "clone");
  await fs.symlink(repoRoot, clonePath);
  return { tempRoot, clonePath };
}

test("bootstrap-home succeeds without ais and only wires generated home files", async () => {
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "agent-rules-hub-home-"));
  const xdgConfigHome = path.join(tempHome, ".xdg-config");
  const { tempRoot, clonePath } = await makeSymlinkedRepoClone();
  const symlinkedScriptPath = path.join(clonePath, "scripts", "bootstrap-home.sh");

  try {
    const { stdout, stderr } = await execFileAsync("bash", [symlinkedScriptPath], {
      cwd: clonePath,
      env: {
        ...process.env,
        HOME: tempHome,
        XDG_CONFIG_HOME: xdgConfigHome,
        WORKSPACE_ROOT: path.join(tempHome, "workspace"),
        AIS_BIN: path.join(tempHome, "missing-bin", "ais")
      }
    });

    assert.match(stdout, /bootstrap complete/);
    assert.match(stderr, /ais is not installed/i);
    assert.match(stderr, /does not auto-install or auto-enable superpowers/i);

    assert.equal(await fs.readlink(path.join(tempHome, ".codex", "AGENTS.md")), path.join(clonePath, "generated", "codex", "AGENTS.md"));
    assert.equal(await fs.readlink(path.join(tempHome, ".claude", "CLAUDE.md")), path.join(clonePath, "generated", "claude", "CLAUDE.md"));
    assert.equal(await fs.readlink(path.join(tempHome, ".gemini", "GEMINI.md")), path.join(clonePath, "generated", "gemini", "GEMINI.md"));
    assert.equal(
      await fs.readlink(path.join(xdgConfigHome, "opencode", "default-instructions.md")),
      path.join(clonePath, "generated", "opencode", "default-instructions.md")
    );

    const opencodeConfig = await fs.readFile(path.join(xdgConfigHome, "opencode", "opencode.jsonc"), "utf8");
    assert.match(opencodeConfig, /default-instructions\.md/);
  } finally {
    await fs.rm(tempHome, { recursive: true, force: true });
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("bootstrap-home does not auto-steer Claude or Gemini add-ons", async () => {
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "agent-rules-hub-home-off-"));
  const xdgConfigHome = path.join(tempHome, ".xdg-config");
  const { tempRoot, clonePath } = await makeSymlinkedRepoClone();
  const symlinkedScriptPath = path.join(clonePath, "scripts", "bootstrap-home.sh");
  const binDir = path.join(tempHome, "bin");
  const claudeLog = path.join(tempHome, "claude.log");
  const geminiLog = path.join(tempHome, "gemini.log");

  try {
    await writeExecutable(path.join(binDir, "claude"), `#!/usr/bin/env bash\necho "$*" >> ${JSON.stringify(claudeLog)}\nif [[ "$1" == "plugins" && "$2" == "list" ]]; then\n  exit 0\nfi\nexit 0\n`);
    await writeExecutable(path.join(binDir, "gemini"), `#!/usr/bin/env bash\necho "$*" >> ${JSON.stringify(geminiLog)}\nexit 0\n`);

    await execFileAsync("bash", [symlinkedScriptPath], {
      cwd: clonePath,
      env: {
        ...process.env,
        HOME: tempHome,
        XDG_CONFIG_HOME: xdgConfigHome,
        WORKSPACE_ROOT: path.join(tempHome, "workspace"),
        AIS_BIN: path.join(tempHome, "missing-bin", "ais"),
        PATH: `${binDir}:${process.env.PATH}`,
        SUPERPOWERS_ROOT: path.join(tempHome, "workspace", "superpowers")
      }
    });

    await assert.rejects(fs.readFile(claudeLog, "utf8"));
    await assert.rejects(fs.readFile(geminiLog, "utf8"));
  } finally {
    await fs.rm(tempHome, { recursive: true, force: true });
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
