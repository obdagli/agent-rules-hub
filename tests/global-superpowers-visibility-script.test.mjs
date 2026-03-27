import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(new URL("../scripts/set-global-superpowers-visibility.sh", import.meta.url));

async function writeExecutable(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
  await fs.chmod(filePath, 0o755);
}

test("set-global-superpowers-visibility only toggles the shared skill symlink", async () => {
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "agent-rules-hub-global-off-"));
  const binDir = path.join(tempHome, "bin");
  const superpowersRoot = path.join(tempHome, "workspace", "superpowers");
  const logFile = path.join(tempHome, "gemini.log");

  try {
    await fs.mkdir(path.join(superpowersRoot, "skills"), { recursive: true });
    await writeExecutable(path.join(binDir, "gemini"), `#!/usr/bin/env bash\necho called >> ${JSON.stringify(logFile)}\n`);

    const env = {
      ...process.env,
      HOME: tempHome,
      WORKSPACE_ROOT: path.join(tempHome, "workspace"),
      SUPERPOWERS_ROOT: superpowersRoot,
      PATH: `${binDir}:${process.env.PATH}`
    };

    await execFileAsync("bash", [scriptPath, "on"], { env });
    const sharedLink = path.join(tempHome, ".agents", "skills", "superpowers");
    assert.equal(await fs.readlink(sharedLink), path.join(superpowersRoot, "skills"));

    await execFileAsync("bash", [scriptPath, "off"], { env });
    await assert.rejects(fs.lstat(sharedLink));
    await assert.rejects(fs.readFile(logFile, "utf8"));
  } finally {
    await fs.rm(tempHome, { recursive: true, force: true });
  }
});
