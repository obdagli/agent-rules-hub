import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(new URL("../scripts/update-opencode-config.mjs", import.meta.url));

test("update-opencode-config script creates a missing config file", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-rules-hub-"));
  const configPath = path.join(tempDir, "opencode.jsonc");

  await execFileAsync("node", [
    scriptPath,
    "--config",
    configPath,
    "--plugin-mode",
    "oh-my-opencode",
    "--ensure-instruction-path",
    "/tmp/default-instructions.md"
  ]);

  const written = await fs.readFile(configPath, "utf8");
  assert.match(written, /"plugin": \[/);
  assert.match(written, /"oh-my-opencode"/);
  assert.match(written, /"\/tmp\/default-instructions\.md"/);

  await fs.rm(tempDir, { recursive: true, force: true });
});
