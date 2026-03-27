import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";

import { HUB_FILES } from "../lib/hub-config.mjs";
import { renderAllInstructions, isInstructionSourcePath } from "../lib/instructions.mjs";
import { buildDashboardState, getManagedFiles, readFileSafe } from "../lib/state.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const STATIC_ROOT = path.join(REPO_ROOT, "dashboard", "static");
const PORT = Number(process.env.AGENT_RULES_DASHBOARD_PORT || 4848);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

const SECURITY_HEADERS = {
  "cache-control": "no-store",
  "content-security-policy": "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY"
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function shell(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || REPO_ROOT,
    encoding: "utf8",
    timeout: options.timeout || 20000
  });

  if (result.error) {
    return {
      ok: false,
      code: 1,
      stdout: "",
      stderr: result.error.message,
      combined: result.error.message
    };
  }

  return {
    ok: result.status === 0,
    code: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    combined: `${result.stdout || ""}${result.stderr || ""}`.trim()
  };
}

function send(response, status, body, contentType, extraHeaders = {}) {
  response.writeHead(status, {
    ...SECURITY_HEADERS,
    "content-type": contentType,
    ...extraHeaders
  });
  response.end(body);
}

function json(response, status, payload, extraHeaders = {}) {
  send(response, status, JSON.stringify(payload, null, 2), MIME_TYPES[".json"], extraHeaders);
}

async function parseRequestBody(request) {
  const contentType = request.headers["content-type"] || "";
  if (!contentType.includes("application/json")) {
    throw new HttpError(415, "Requests to this endpoint must use application/json.");
  }

  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
}

function isAuthorizedApiRequest(request, authToken, port) {
  const providedToken = request.headers["x-agent-rules-token"];
  if (providedToken !== authToken) return false;

  const origin = request.headers.origin;
  if (!origin) return true;

  return origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`;
}

async function serveStatic(requestPath, response, { authToken, staticRoot }) {
  const normalized = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.join(staticRoot, normalized);
  if (!filePath.startsWith(staticRoot)) {
    json(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const rawContents = await fs.readFile(filePath, "utf8");
    const contentType = MIME_TYPES[path.extname(filePath)] || "application/octet-stream";
    const contents = normalized === "/index.html"
      ? rawContents.replaceAll("__AGENT_RULES_TOKEN__", authToken)
      : rawContents;
    send(response, 200, contents, contentType);
  } catch {
    json(response, 404, { error: "Not found" });
  }
}

async function handleApi(request, response, url, deps) {
  const {
    authToken,
    port,
    buildState,
    getManagedFilesFn,
    readFileFn,
    renderAllInstructionsFn,
    writeFileFn,
    shellFn
  } = deps;

  if (!isAuthorizedApiRequest(request, authToken, port)) {
    json(response, 403, { error: "Forbidden" });
    return;
  }

  const managedFiles = await getManagedFilesFn();
  const managedMap = new Map(managedFiles.map((file) => [file.path, file]));

  if (request.method === "GET" && url.pathname === "/api/state") {
    json(response, 200, await buildState());
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/file") {
    const filePath = url.searchParams.get("path");
    const managed = filePath ? managedMap.get(filePath) : null;
    if (!managed) {
      json(response, 400, { error: "Unknown or disallowed file" });
      return;
    }

    const content = await readFileFn(filePath);
    json(response, 200, {
      path: filePath,
      editable: managed.editable,
      content
    });
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/file") {
    const body = await parseRequestBody(request);
    const managed = body.path ? managedMap.get(body.path) : null;
    if (!managed) {
      json(response, 400, { error: "Unknown or disallowed file" });
      return;
    }
    if (!managed.editable) {
      json(response, 400, { error: "This managed file is read-only. Edit the source layer instead." });
      return;
    }

    await writeFileFn(body.path, body.content ?? "", "utf8");
    const rendered = isInstructionSourcePath(body.path) ? await renderAllInstructionsFn() : [];
    json(response, 200, {
      ok: true,
      path: body.path,
      savedAt: new Date().toISOString(),
      rendered: rendered.map((item) => item.outputPath)
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/action/bootstrap-home") {
    await parseRequestBody(request);
    const result = shellFn("bash", [HUB_FILES.bootstrapScript]);
    json(response, result.ok ? 200 : 500, {
      ok: result.ok,
      output: result.combined,
      code: result.code
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/action/opencode-plugin") {
    const body = await parseRequestBody(request);
    const result = shellFn("bash", [HUB_FILES.setOpencodePluginScript, body.mode]);
    json(response, result.ok ? 200 : 500, {
      ok: result.ok,
      output: result.combined,
      code: result.code
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/action/global-superpowers-visibility") {
    const body = await parseRequestBody(request);
    const result = shellFn("bash", [HUB_FILES.setGlobalSuperpowersVisibilityScript, body.mode]);
    json(response, result.ok ? 200 : 500, {
      ok: result.ok,
      output: result.combined,
      code: result.code
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/action/codex-orchestrator") {
    const body = await parseRequestBody(request);
    const result = shellFn("bash", [HUB_FILES.setCodexOrchestratorScript, body.mode]);
    json(response, result.ok ? 200 : 500, {
      ok: result.ok,
      output: result.combined,
      code: result.code
    });
    return;
  }

  json(response, 404, { error: "Unknown API route" });
}

export function createDashboardServer({
  authToken = process.env.AGENT_RULES_DASHBOARD_TOKEN || crypto.randomBytes(24).toString("hex"),
  port = PORT,
  staticRoot = STATIC_ROOT,
  buildState = buildDashboardState,
  getManagedFilesFn = getManagedFiles,
  readFileFn = readFileSafe,
  renderAllInstructionsFn = renderAllInstructions,
  writeFileFn = fs.writeFile.bind(fs),
  shellFn = shell
} = {}) {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      if (url.pathname.startsWith("/api/")) {
        await handleApi(request, response, url, {
          authToken,
          port,
          buildState,
          getManagedFilesFn,
          readFileFn,
          renderAllInstructionsFn,
          writeFileFn,
          shellFn
        });
        return;
      }

      await serveStatic(url.pathname, response, { authToken, staticRoot });
    } catch (error) {
      if (error instanceof HttpError) {
        json(response, error.status, { error: error.message });
        return;
      }

      json(response, 500, {
        error: "Server error",
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return { server, authToken, port };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await renderAllInstructions();
  const { server, port } = createDashboardServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`Agent Rules Hub dashboard running at http://127.0.0.1:${port}`);
  });
}
