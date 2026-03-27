import test from "node:test";
import assert from "node:assert/strict";

import { applyOpencodeConfigChanges, getOpencodeDeliveryState, pluginEntriesForMode } from "../lib/opencode-config.mjs";

test("pluginEntriesForMode returns the expected OpenCode plugin list", () => {
  assert.deepEqual(pluginEntriesForMode("oh-my-opencode"), ["oh-my-opencode"]);
  assert.deepEqual(pluginEntriesForMode("both"), [
    "oh-my-opencode",
    "superpowers@git+https://github.com/obra/superpowers.git"
  ]);
});

test("applyOpencodeConfigChanges adds a plugin block when the config does not already contain one", () => {
  const raw = `{
  "instructions": [
    "/tmp/other.md"
  ]
}
`;

  const result = applyOpencodeConfigChanges({
    raw,
    pluginMode: "oh-my-opencode",
    ensureInstructionPath: "/home/test/.config/opencode/default-instructions.md"
  });

  assert.deepEqual(result.data.plugin, ["oh-my-opencode"]);
  assert.equal(result.data.instructions[0], "/home/test/.config/opencode/default-instructions.md");
  assert.match(result.content, /"plugin": \[/);
});

test("getOpencodeDeliveryState detects when the managed delivery path is missing", () => {
  const state = getOpencodeDeliveryState(
    {
      instructions: ["/tmp/other.md"]
    },
    {
      homePath: "/home/test/.config/opencode/default-instructions.md",
      generatedPath: "/repo/generated/opencode/default-instructions.md"
    }
  );

  assert.equal(state.configured, false);
  assert.equal(state.configuredHomePath, false);
  assert.equal(state.configuredGeneratedPath, false);
});
