import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFileWorkspaceModel,
  buildHeroStats,
  buildProfileWorkspaceModel,
  formatDisplayPath,
  getDefaultToolId
} from "../dashboard/static/view-model.js";

test("buildHeroStats derives top-level counts from the snapshot", () => {
  const snapshot = {
    tools: [{ id: "codex" }, { id: "claude" }, { id: "gemini" }, { id: "opencode" }],
    managedFiles: [{ editable: true }, { editable: false }, { editable: true }],
    warnings: ["warning-a"],
    discoverySummary: { rules: 6, skills: 9 }
  };

  assert.deepEqual(buildHeroStats(snapshot), [
    { label: "Active CLIs", value: "04" },
    { label: "Editable Files", value: "03" },
    { label: "Warnings", value: "01" },
    { label: "Rules Found", value: "06" },
    { label: "Skills Found", value: "09" }
  ]);
});

test("formatDisplayPath compacts long home-directory paths for display", () => {
  assert.equal(
    formatDisplayPath("/home/tester/.config/superpowers/worktrees/agent-rules-hub/feature-dashboard-overhaul/shared/overlays/codex.md"),
    "~/.config/superpowers/.../shared/overlays/codex.md"
  );
});

test("getDefaultToolId prefers the first managed profile before falling back", () => {
  const tools = [
    { id: "codex", profileStatus: { status: "managed" } },
    { id: "gemini", profileStatus: { status: "detected" } }
  ];

  assert.equal(getDefaultToolId(tools), "codex");
});

test("buildProfileWorkspaceModel returns the selected tool and overview cards", () => {
  const snapshot = {
    tools: [
      { id: "codex", label: "Codex", profileStatus: { status: "managed", summary: "Ready" } },
      { id: "gemini", label: "Gemini", profileStatus: { status: "detected", summary: "Detected" } }
    ]
  };

  const model = buildProfileWorkspaceModel(snapshot, "gemini");

  assert.equal(model.activeTool.id, "gemini");
  assert.equal(model.cards.length, 2);
  assert.equal(model.cards[1].id, "gemini");
});

test("buildProfileWorkspaceModel falls back to the recommended tool when the selection is missing", () => {
  const snapshot = {
    tools: [
      { id: "codex", label: "Codex", profileStatus: { status: "managed", summary: "Ready" } },
      { id: "gemini", label: "Gemini", profileStatus: { status: "detected", summary: "Detected" } }
    ]
  };

  const model = buildProfileWorkspaceModel(snapshot, "missing-tool");

  assert.equal(model.activeTool.id, "codex");
});

test("buildFileWorkspaceModel filters files by search term", () => {
  const files = [
    { group: "Docs", label: "README", path: "/repo/README.md", editable: true },
    { group: "CLI Overlays", label: "Gemini Overlay", path: "/repo/shared/overlays/gemini.md", editable: true }
  ];

  const model = buildFileWorkspaceModel(files, "gem", ["/repo/shared/overlays/gemini.md"]);

  assert.deepEqual([...model.groups.keys()], ["CLI Overlays"]);
  assert.equal(model.totalMatches, 1);
  assert.equal(model.isFiltered, true);
  assert.equal(model.groups.get("CLI Overlays")[0].dirty, true);
});
