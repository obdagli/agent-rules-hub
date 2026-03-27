import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(new URL("../scripts/set-codex-orchestrator.sh", import.meta.url));

async function runStatus(tempHome) {
  const { stdout } = await execFileAsync("bash", [scriptPath, "status"], {
    env: {
      ...process.env,
      HOME: tempHome,
      PATH: "/usr/bin:/bin"
    }
  });

  return stdout.trim();
}

test("set-codex-orchestrator infers omx-primary without requiring rg", async () => {
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "agent-rules-hub-codex-mode-"));

  try {
    await fs.mkdir(path.join(tempHome, ".codex"), { recursive: true });
    await fs.writeFile(path.join(tempHome, ".codex", "AGENTS.md"), "# oh-my-codex\n");

    assert.equal(await runStatus(tempHome), "omx-primary");
  } finally {
    await fs.rm(tempHome, { recursive: true, force: true });
  }
});
