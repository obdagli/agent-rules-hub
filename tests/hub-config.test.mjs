import test from "node:test";
import assert from "node:assert/strict";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

import {
  resolveSuperpowersRoot,
  resolveWorkspaceRoot,
  resolveXdgConfigHome
} from "../lib/hub-config.mjs";

test("resolveXdgConfigHome prefers XDG_CONFIG_HOME", () => {
  const home = "/tmp/home";

  assert.equal(
    resolveXdgConfigHome({ home, env: { XDG_CONFIG_HOME: "/tmp/xdg-config" } }),
    "/tmp/xdg-config"
  );
});

test("resolveWorkspaceRoot falls back to ~/workspace when WORKSPACE_ROOT is unset", () => {
  assert.equal(
    resolveWorkspaceRoot({ home: "/tmp/home", env: {} }),
    "/tmp/home/workspace"
  );
});

test("resolveSuperpowersRoot prefers WORKSPACE_ROOT/superpowers over the default workspace fallback", async () => {
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "agent-rules-hub-config-"));
  const workspaceRoot = path.join(tempHome, "workspace-root");
  const expected = path.join(workspaceRoot, "superpowers");
  const secondaryWorkspaceRoot = path.join(tempHome, "workspace", "superpowers");

  try {
    await fs.mkdir(path.join(expected, "skills"), { recursive: true });
    await fs.mkdir(path.join(secondaryWorkspaceRoot, "skills"), { recursive: true });

    const resolved = resolveSuperpowersRoot({
      repoRoot: path.join(tempHome, "repo"),
      home: tempHome,
      env: { WORKSPACE_ROOT: workspaceRoot },
      existsSync: fsSync.existsSync,
      realpathSync: fsSync.realpathSync
    });

    assert.equal(resolved, expected);
  } finally {
    await fs.rm(tempHome, { recursive: true, force: true });
  }
});
