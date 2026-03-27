import test from "node:test";
import assert from "node:assert/strict";

import { createDashboardServer } from "../dashboard/server.mjs";
import { HUB_FILES } from "../lib/hub-config.mjs";

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(address.port);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

test("dashboard API rejects requests without the session token", async () => {
  const { server } = createDashboardServer({
    authToken: "test-token",
    buildState: async () => ({ ok: true }),
    getManagedFilesFn: async () => [],
    readFileFn: async () => "",
    renderAllInstructionsFn: async () => []
  });

  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/state`);
    assert.equal(response.status, 403);
  } finally {
    await close(server);
  }
});

test("dashboard index injects the runtime session token", async () => {
  const { server } = createDashboardServer({
    authToken: "token-from-test",
    buildState: async () => ({ ok: true }),
    getManagedFilesFn: async () => [],
    readFileFn: async () => "",
    renderAllInstructionsFn: async () => []
  });

  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /token-from-test/);
    assert.doesNotMatch(html, /__AGENT_RULES_TOKEN__/);
  } finally {
    await close(server);
  }
});

test("dashboard index exposes the sectioned workspace shell", async () => {
  const { server } = createDashboardServer({
    authToken: "token-from-test",
    buildState: async () => ({ ok: true }),
    getManagedFilesFn: async () => [],
    readFileFn: async () => "",
    renderAllInstructionsFn: async () => []
  });

  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/`);
    const html = await response.text();

    assert.match(html, /data-section-target="profiles"/);
    assert.match(html, /data-section-target="files"/);
    assert.match(html, /id="profilesSection"/);
    assert.match(html, /id="operationsSection"/);
    assert.match(html, /id="actionSummary"/);
    assert.match(html, />Agent Rules Hub</);
    assert.match(html, /id="toolGrid"[\s\S]*id="profileSpotlight"/);
    assert.match(html, /id="discardFile"/);
    assert.match(html, /id="opencodeModeSummary"/);
    assert.match(html, /id="visibilitySummary"/);
    assert.match(html, /id="codexModeSummary"/);
    assert.match(html, /data-codex-mode="omx-primary"/);
  } finally {
    await close(server);
  }
});

test("dashboard stylesheet defines the workspace rail and profile overview system", async () => {
  const { server } = createDashboardServer({
    authToken: "token-from-test",
    buildState: async () => ({ ok: true }),
    getManagedFilesFn: async () => [],
    readFileFn: async () => "",
    renderAllInstructionsFn: async () => []
  });

  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/styles.css`);
    const css = await response.text();

    assert.match(css, /\.app-rail\b/);
    assert.match(css, /\.workspace-stage\b/);
    assert.match(css, /\.profile-card\b/);
    assert.match(css, /\.file-item\.dirty\b/);
    assert.match(css, /grid-template-columns:\s*160px minmax\(0,\s*1fr\)/);
    assert.match(css, /\.rail-button\s*\{[\s\S]*min-height:\s*60px;/);
    assert.match(css, /@media \(max-width: 640px\) \{[\s\S]*\.rail-nav\s*\{[\s\S]*display:\s*flex;/);
    assert.match(css, /@media \(max-width: 640px\) \{[\s\S]*\.rail-footer\s*\{[\s\S]*display:\s*none;/);
    assert.match(css, /\.operation-mode-summary\b/);
    assert.match(css, /\.button-secondary\b/);
  } finally {
    await close(server);
  }
});

test("dashboard file API rejects unknown file paths that are not in the managed editor surface", async () => {
  const { server } = createDashboardServer({
    authToken: "test-token",
    buildState: async () => ({ ok: true }),
    getManagedFilesFn: async () => [
      {
        path: "/tmp/allowed.md",
        editable: true
      }
    ],
    readFileFn: async () => "",
    renderAllInstructionsFn: async () => []
  });

  const port = await listen(server);

  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/file?path=${encodeURIComponent("/home/test/.config/opencode/unknown.jsonc")}`,
      {
        headers: {
          "x-agent-rules-token": "test-token"
        }
      }
    );
    assert.equal(response.status, 400);
  } finally {
    await close(server);
  }
});

test("dashboard file API writes managed runtime config files", async () => {
  let saved = null;
  const { server } = createDashboardServer({
    authToken: "test-token",
    buildState: async () => ({ ok: true }),
    getManagedFilesFn: async () => [
      {
        path: "/tmp/config.toml",
        editable: true
      }
    ],
    readFileFn: async () => 'model = "gpt-5.4"\n',
    renderAllInstructionsFn: async () => [],
    writeFileFn: async (filePath, content) => {
      saved = { filePath, content };
    }
  });

  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/file`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-agent-rules-token": "test-token"
      },
      body: JSON.stringify({
        path: "/tmp/config.toml",
        content: 'model = "gpt-5.3-codex"\n'
      })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(saved, {
      filePath: "/tmp/config.toml",
      content: 'model = "gpt-5.3-codex"\n'
    });
  } finally {
    await close(server);
  }
});

test("dashboard file API reads and writes discovered editable files", async () => {
  let saved = null;
  const discoveredFile = {
    path: "/tmp/discovered-rule/AGENTS.md",
    label: "Repo rule: nested-project/AGENTS.md",
    group: "Repo Rule Files",
    editable: true
  };

  const { server } = createDashboardServer({
    authToken: "test-token",
    buildState: async () => ({ ok: true }),
    getManagedFilesFn: async () => [discoveredFile],
    readFileFn: async (filePath) => `contents for ${filePath}`,
    renderAllInstructionsFn: async () => [],
    writeFileFn: async (filePath, content) => {
      saved = { filePath, content };
    }
  });

  const port = await listen(server);

  try {
    const readResponse = await fetch(
      `http://127.0.0.1:${port}/api/file?path=${encodeURIComponent(discoveredFile.path)}`,
      {
        headers: {
          "x-agent-rules-token": "test-token"
        }
      }
    );

    assert.equal(readResponse.status, 200);
    const readPayload = await readResponse.json();
    assert.equal(readPayload.path, discoveredFile.path);
    assert.equal(readPayload.editable, true);

    const writeResponse = await fetch(`http://127.0.0.1:${port}/api/file`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-agent-rules-token": "test-token"
      },
      body: JSON.stringify({
        path: discoveredFile.path,
        content: "# updated discovered rule\n"
      })
    });

    assert.equal(writeResponse.status, 200);
    assert.deepEqual(saved, {
      filePath: discoveredFile.path,
      content: "# updated discovered rule\n"
    });
  } finally {
    await close(server);
  }
});

test("dashboard API triggers codex orchestrator mode actions", async () => {
  const calls = [];
  const { server } = createDashboardServer({
    authToken: "test-token",
    buildState: async () => ({ ok: true }),
    getManagedFilesFn: async () => [],
    readFileFn: async () => "",
    renderAllInstructionsFn: async () => [],
    shellFn: (command, args) => {
      calls.push({ command, args });
      return {
        ok: true,
        code: 0,
        stdout: "",
        stderr: "",
        combined: "mode switched"
      };
    }
  });

  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/action/codex-orchestrator`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-agent-rules-token": "test-token"
      },
      body: JSON.stringify({
        mode: "omx-primary"
      })
    });

    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      command: "bash",
      args: [HUB_FILES.setCodexOrchestratorScript, "omx-primary"]
    });
  } finally {
    await close(server);
  }
});
