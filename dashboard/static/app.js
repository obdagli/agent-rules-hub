import {
  buildFileWorkspaceModel,
  formatDisplayPath,
  buildHeroStats,
  buildProfileWorkspaceModel,
  getDefaultToolId
} from "./view-model.js";

function readInitialRoute() {
  const params = new URLSearchParams(window.location.search);
  const section = params.get("section");
  const validSections = new Set(["profiles", "files", "bench", "operations"]);

  return {
    section: validSections.has(section) ? section : "profiles",
    toolId: params.get("tool") || null,
    filePath: params.get("path") || null
  };
}

const initialRoute = readInitialRoute();

const state = {
  snapshot: null,
  activeSection: initialRoute.section,
  selectedToolId: initialRoute.toolId,
  activePath: null,
  activeEditable: false,
  savedContent: "",
  searchTerm: "",
  dirtyPaths: new Set(),
  isBusy: false,
  initialFilePath: initialRoute.filePath,
  initialRouteApplied: false
};

const sessionToken = document.querySelector('meta[name="agent-rules-token"]')?.content || "";

const dom = {
  warnings: document.querySelector("#warnings"),
  generatedAt: document.querySelector("#generatedAt"),
  heroStats: document.querySelector("#heroStats"),
  actionSummary: document.querySelector("#actionSummary"),
  profileSpotlight: document.querySelector("#profileSpotlight"),
  toolGrid: document.querySelector("#toolGrid"),
  benchGrid: document.querySelector("#benchGrid"),
  fileList: document.querySelector("#fileList"),
  fileSearch: document.querySelector("#fileSearch"),
  editorTitle: document.querySelector("#editorTitle"),
  editorPath: document.querySelector("#editorPath"),
  editor: document.querySelector("#editor"),
  discardFile: document.querySelector("#discardFile"),
  saveFile: document.querySelector("#saveFile"),
  refreshState: document.querySelector("#refreshState"),
  bootstrapHome: document.querySelector("#bootstrapHome"),
  actionOutput: document.querySelector("#actionOutput"),
  codexModeSummary: document.querySelector("#codexModeSummary"),
  opencodeModeSummary: document.querySelector("#opencodeModeSummary"),
  visibilitySummary: document.querySelector("#visibilitySummary"),
  toolCardTemplate: document.querySelector("#toolCardTemplate"),
  benchCardTemplate: document.querySelector("#benchCardTemplate"),
  railButtons: Array.from(document.querySelectorAll("[data-section-target]")),
  sectionPanels: Array.from(document.querySelectorAll("[data-section-panel]")),
  codexModeButtons: Array.from(document.querySelectorAll("[data-codex-mode]")),
  pluginModeButtons: Array.from(document.querySelectorAll("[data-plugin-mode]")),
  visibilityModeButtons: Array.from(document.querySelectorAll("[data-visibility-mode]")),
  actionButtons: Array.from(document.querySelectorAll("[data-codex-mode], [data-plugin-mode], [data-visibility-mode]"))
};

function setActionStatus(message, tone = "idle") {
  const normalizedTone = ["idle", "pending", "success", "error"].includes(tone) ? tone : "idle";
  dom.actionSummary.textContent = message;
  dom.actionSummary.className = `action-summary action-summary-${normalizedTone}`;
}

function setOperationStatus(message, tone = "idle") {
  const normalizedTone = ["idle", "pending", "success", "error"].includes(tone) ? tone : "idle";
  dom.actionOutput.textContent = message;
  dom.actionOutput.className = `action-output action-output-${normalizedTone}`;
}

function isActiveFileDirty() {
  return Boolean(state.activePath) && state.dirtyPaths.has(state.activePath);
}

function updateFileActions() {
  const isDirty = isActiveFileDirty();
  const isEnabled = state.activeEditable && isDirty;
  dom.saveFile.disabled = state.isBusy || !isEnabled;
  dom.discardFile.disabled = state.isBusy || !isEnabled;
}

function getOpencodePluginMode(snapshot) {
  const opencode = snapshot?.tools?.find((tool) => tool.id === "opencode");
  const pluginSource = opencode?.activeSources?.find((source) => source.label === "OpenCode plugin array");
  const entries = pluginSource?.entries || [];
  const hasOhMy = entries.includes("oh-my-opencode");
  const hasSuperpowers = entries.some((entry) => entry.includes("superpowers"));

  if (hasOhMy && hasSuperpowers) return "both";
  if (hasOhMy) return "oh-my-opencode";
  if (hasSuperpowers) return "superpowers";
  return "none";
}

function formatPluginMode(mode) {
  switch (mode) {
    case "oh-my-opencode":
      return "oh-my-opencode only";
    case "superpowers":
      return "superpowers only";
    case "both":
      return "both harnesses active";
    default:
      return "no harness plugin";
  }
}

function formatCodexMode(mode) {
  switch (mode) {
    case "omx-primary":
      return "OMX primary";
    case "hybrid-tools-only":
      return "Hybrid tools only";
    case "superpowers-primary":
      return "Superpowers primary";
    default:
      return "Custom";
  }
}

function syncActionButtons() {
  const codexMode = state.snapshot?.codexOrchestratorMode || "superpowers-primary";
  const pluginMode = getOpencodePluginMode(state.snapshot);
  const visibilityMode = state.snapshot?.globalSuperpowersVisibility === "off" ? "off" : "on";

  dom.codexModeButtons.forEach((button) => {
    const isSelected = button.dataset.codexMode === codexMode;
    button.classList.toggle("button-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
    button.disabled = state.isBusy || isSelected;
  });

  dom.pluginModeButtons.forEach((button) => {
    const isSelected = button.dataset.pluginMode === pluginMode;
    button.classList.toggle("button-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
    button.disabled = state.isBusy || isSelected;
  });

  dom.visibilityModeButtons.forEach((button) => {
    const isSelected = button.dataset.visibilityMode === visibilityMode;
    button.classList.toggle("button-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
    button.disabled = state.isBusy || isSelected;
  });

  if (dom.codexModeSummary) {
    dom.codexModeSummary.textContent = `Current mode: ${formatCodexMode(codexMode)}`;
  }

  if (dom.opencodeModeSummary) {
    dom.opencodeModeSummary.textContent = `Current mode: ${formatPluginMode(pluginMode)}`;
  }

  if (dom.visibilitySummary) {
    dom.visibilitySummary.textContent = visibilityMode === "on"
      ? "Shared discovery: visible to supported CLIs"
      : "Shared discovery: hidden globally";
  }
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "content-type": "application/json",
      "x-agent-rules-token": sessionToken,
      ...(options.headers || {})
    },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || payload.detail || "Request failed");
  }
  return payload;
}

function setBusy(isBusy) {
  state.isBusy = isBusy;

  dom.refreshState.disabled = isBusy;
  dom.bootstrapHome.disabled = isBusy;
  syncActionButtons();
  updateFileActions();
}

function setActiveSection(section) {
  state.activeSection = section;

  dom.railButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.sectionTarget === section);
  });

  dom.sectionPanels.forEach((panel) => {
    const isActive = panel.dataset.sectionPanel === section;
    panel.hidden = !isActive;
    panel.classList.toggle("section-active", isActive);
  });
}

function resetEditor() {
  state.activePath = null;
  state.activeEditable = false;
  state.savedContent = "";
  dom.editorTitle.textContent = "Select A File";
  dom.editorTitle.dataset.baseTitle = "Select A File";
  dom.editorPath.textContent = "Pick a discovered rule, skill file, generated view, benchmark file, or local runtime config. Runtime config edits can affect live CLI behavior immediately.";
  dom.editorPath.removeAttribute("title");
  dom.editor.value = "";
  dom.editor.readOnly = true;
  updateFileActions();
}

function updateEditorChrome() {
  const baseTitle = dom.editorTitle.dataset.baseTitle || "Select A File";
  dom.editorTitle.textContent = isActiveFileDirty() ? `${baseTitle} • Modified` : baseTitle;
  updateFileActions();
}

function markDirtyState(isDirty) {
  if (!state.activePath) return;

  if (isDirty) {
    state.dirtyPaths.add(state.activePath);
  } else {
    state.dirtyPaths.delete(state.activePath);
  }

  updateEditorChrome();
  renderFileList(state.snapshot?.managedFiles || []);
}

function renderWarnings(warnings = []) {
  dom.warnings.innerHTML = "";
  warnings.forEach((warning) => {
    const card = document.createElement("div");
    card.className = "warning-card";
    card.textContent = warning;
    dom.warnings.appendChild(card);
  });
}

function renderHeroStats(stats) {
  dom.heroStats.innerHTML = "";
  stats.forEach((stat) => {
    const card = document.createElement("article");
    card.className = "hero-stat";
    card.innerHTML = `<span class="hero-stat-value">${stat.value}</span><span class="hero-stat-label">${stat.label}</span>`;
    dom.heroStats.appendChild(card);
  });
}

function renderChipRow(container, values) {
  container.innerHTML = "";
  const items = values.length ? values : ["None"];
  items.forEach((value) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = value;
    container.appendChild(chip);
  });
}

function renderPlainList(container, values) {
  container.innerHTML = "";
  values.forEach((value) => {
    const item = document.createElement("li");
    item.textContent = value;
    container.appendChild(item);
  });
}

function renderInstructionStack(container, stack) {
  container.innerHTML = "";
  stack.forEach((layer) => {
    const row = document.createElement("div");
    row.className = "stack-row";

    const order = document.createElement("span");
    order.className = "stack-order";
    order.textContent = String(layer.order);
    row.appendChild(order);

    const content = document.createElement("div");
    content.className = "stack-content";

    const label = document.createElement("p");
    label.className = "stack-label";
    label.textContent = layer.label;
    content.appendChild(label);

    const pathNode = document.createElement("p");
    pathNode.className = "stack-path";
    pathNode.textContent = formatDisplayPath(layer.path);
    pathNode.title = layer.path;
    content.appendChild(pathNode);

    row.appendChild(content);
    container.appendChild(row);
  });
}

function renderSyncFacts(container, syncState) {
  container.innerHTML = "";
  const rows = syncState.facts || [
    ["Generated", syncState.generatedPath],
    ["Home path", syncState.homeLabel],
    ["Resolved", syncState.resolvedPath]
  ];

  rows.forEach(([label, value]) => {
    const wrapper = document.createElement("div");
    wrapper.className = "fact-row";

    const term = document.createElement("span");
    term.className = "fact-label";
    term.textContent = label;
    wrapper.appendChild(term);

    const detail = document.createElement("code");
    detail.className = "fact-value";
    detail.textContent = formatDisplayPath(value);
    detail.title = value;
    wrapper.appendChild(detail);

    container.appendChild(wrapper);
  });
}

function renderSources(container, sources) {
  container.innerHTML = "";
  sources.forEach((source) => {
    const wrapper = document.createElement("div");
    wrapper.className = "skill-source";

    const header = document.createElement("div");
    header.className = "skill-source-header";

    const title = document.createElement("p");
    title.className = "skill-source-title";
    title.textContent = source.label;
    header.appendChild(title);

    const badge = document.createElement("span");
    badge.className = `source-badge ${source.managedByHub ? "source-badge-managed" : "source-badge-external"}`;
    badge.textContent = source.managedByHub ? "Hub-managed" : "External";
    header.appendChild(badge);

    wrapper.appendChild(header);

    const pathNode = document.createElement("div");
    pathNode.className = "skill-source-path";
    pathNode.textContent = formatDisplayPath(source.path);
    pathNode.title = source.path;
    wrapper.appendChild(pathNode);

    const note = document.createElement("p");
    note.className = "skill-source-note";
    note.textContent = source.note;
    wrapper.appendChild(note);

    const list = document.createElement("div");
    list.className = "skill-list";
    renderChipRow(list, source.entries || []);
    wrapper.appendChild(list);

    container.appendChild(wrapper);
  });
}

function renderProfileGlance(container, tool) {
  container.innerHTML = "";
  const cards = [
    ["Instruction layers", String(tool.instructionStack.length)],
    ["Active source groups", String(tool.activeSources.length)],
    ["Editable files", String(tool.managedFiles.length)],
    ["Capabilities", String((tool.capabilities || []).length)]
  ];

  cards.forEach(([label, value]) => {
    const item = document.createElement("article");
    item.className = "glance-card";
    item.innerHTML = `<span class="glance-label">${label}</span><strong class="glance-value">${value}</strong>`;
    container.appendChild(item);
  });
}

function renderToolDetail(tool) {
  dom.profileSpotlight.innerHTML = "";
  if (!tool) {
    dom.profileSpotlight.innerHTML = "<p class=\"muted\">No profile selected.</p>";
    return;
  }

  const fragment = dom.toolCardTemplate.content.cloneNode(true);
  fragment.querySelector(".tool-kicker").textContent = "Selected Profile";
  fragment.querySelector(".tool-title").textContent = tool.label;
  fragment.querySelector(".tool-summary").textContent = tool.profileStatus.summary;
  fragment.querySelector(".tool-preferred-profile").textContent = tool.preferredProfile;

  const status = fragment.querySelector(".status-pill");
  status.textContent = tool.profileStatus.status;
  status.classList.add(`status-${tool.profileStatus.status}`);

  renderProfileGlance(fragment.querySelector(".profile-glance"), tool);
  renderInstructionStack(fragment.querySelector(".instruction-stack"), tool.instructionStack);
  renderSyncFacts(fragment.querySelector(".fact-list"), tool.syncState);
  renderSources(fragment.querySelector(".skill-sources"), tool.activeSources);
  renderChipRow(fragment.querySelector(".capabilities"), tool.capabilities || []);
  renderPlainList(fragment.querySelector(".constraints"), tool.constraints || []);
  renderPlainList(fragment.querySelector(".restart-hints"), tool.restartHints || []);
  renderPlainList(fragment.querySelector(".status-details"), tool.profileStatus.details || []);

  fragment.querySelectorAll(".tool-section").forEach((section) => {
    const heading = section.querySelector("h4")?.textContent?.trim();
    if (heading === "Editable Files" || heading === "Status Details" || heading === "Restart / Reload") {
      section.classList.add("tool-section-wide");
    }

    if (heading === "Constraints" || heading === "Restart / Reload" || heading === "Editable Files") {
      const disclosure = document.createElement("details");
      disclosure.className = "tool-disclosure";

      const summary = document.createElement("summary");
      summary.textContent = heading;
      disclosure.appendChild(summary);

      const body = document.createElement("div");
      body.className = "tool-disclosure-body";

      Array.from(section.children).forEach((child) => {
        if (child.tagName !== "H4") {
          body.appendChild(child);
        }
      });

      disclosure.appendChild(body);
      section.innerHTML = "";
      section.appendChild(disclosure);
    }
  });

  const managedFiles = fragment.querySelector(".managed-files");
  managedFiles.innerHTML = "";
  tool.managedFiles.forEach((file) => {
    const button = document.createElement("button");
    button.className = "file-link-button";
    button.type = "button";
    button.innerHTML = `<strong>${file.label}</strong><span>${formatDisplayPath(file.path)}</span><em>${file.editable ? "Editable" : "Read only"}</em>`;
    button.title = file.path;
    button.addEventListener("click", () => focusFile(file.path));
    managedFiles.appendChild(button);
  });

  dom.profileSpotlight.appendChild(fragment);
}

function renderToolOverview(cards) {
  dom.toolGrid.innerHTML = "";
  cards.forEach((card) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `profile-card ${card.id === state.selectedToolId ? "active" : ""}`;
    button.innerHTML = `
      <span class="profile-card-kicker">${card.status}</span>
      <strong class="profile-card-title">${card.label}</strong>
      <span class="profile-card-summary">${card.summary}</span>
    `;
    button.addEventListener("click", () => {
      state.selectedToolId = card.id;
      renderProfiles(state.snapshot);
    });
    dom.toolGrid.appendChild(button);
  });
}

function renderProfiles(snapshot) {
  const model = buildProfileWorkspaceModel(snapshot, state.selectedToolId);
  state.selectedToolId = model.activeTool?.id || null;
  renderToolOverview(model.cards);
  renderToolDetail(model.activeTool);
}

function renderFileList(files) {
  dom.fileList.innerHTML = "";
  const { groups, totalMatches, isFiltered } = buildFileWorkspaceModel(
    files,
    state.searchTerm,
    [...state.dirtyPaths]
  );

  if (groups.size === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = isFiltered ? "No files match this filter." : "No discovered files available.";
    dom.fileList.appendChild(empty);
    return;
  }

  groups.forEach((entries, group) => {
    const label = document.createElement("div");
    label.className = "file-group-label";
    label.textContent = `${group}${isFiltered ? ` (${entries.length})` : ""}`;
    dom.fileList.appendChild(label);

    entries.forEach((file) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `file-item ${state.activePath === file.path ? "active" : ""} ${file.dirty ? "dirty" : ""}`;
      button.innerHTML = `
        <span class="file-item-title-row">
          <strong>${file.label}</strong>
          ${file.dirty ? "<span class=\"file-dirty-badge\">Modified</span>" : ""}
        </span>
        <span class="file-item-path">${formatDisplayPath(file.path)}</span>
        <em class="file-item-kind">${file.editable ? "Editable" : "Read only"}</em>
      `;
      button.title = file.path;
      button.addEventListener("click", () => loadFile(file, { activateSection: true }));
      dom.fileList.appendChild(button);
    });
  });

  if (isFiltered) {
    const matchCount = document.createElement("div");
    matchCount.className = "file-group-label";
    matchCount.textContent = `${totalMatches} match${totalMatches === 1 ? "" : "es"}`;
    dom.fileList.prepend(matchCount);
  }
}

function renderBench(bench) {
  dom.benchGrid.innerHTML = "";
  bench.forEach((entry) => {
    const fragment = dom.benchCardTemplate.content.cloneNode(true);
    fragment.querySelector(".bench-category").textContent = entry.category;
    fragment.querySelector(".bench-title").textContent = entry.title;
    fragment.querySelector(".bench-objective").textContent = entry.objective;
    fragment.querySelector(".prompt-block").textContent = entry.prompt;
    fragment.querySelector(".bench-install-decision").textContent = entry.installDecision;

    renderPlainList(fragment.querySelector(".bench-watch-for"), entry.watchFor || []);

    const expectations = fragment.querySelector(".bench-expectations");
    expectations.innerHTML = "";
    Object.entries(entry.expectations || {}).forEach(([toolId, text]) => {
      const row = document.createElement("div");
      row.className = "expectation-row";
      row.innerHTML = `<strong>${toolId}</strong><p>${text}</p>`;
      expectations.appendChild(row);
    });

    fragment.querySelector(".copy-prompt").addEventListener("click", async () => {
      await navigator.clipboard.writeText(entry.prompt);
      setActionStatus(`Copied benchmark prompt: ${entry.title}`, "success");
    });

    dom.benchGrid.appendChild(fragment);
  });
}

async function loadFile(file, { activateSection = true } = {}) {
  if (isActiveFileDirty() && file.path !== state.activePath) {
    setActionStatus("Save or discard the current file before opening a different one.", "error");
    return;
  }

  const payload = await request(`/api/file?path=${encodeURIComponent(file.path)}`);
  state.activePath = file.path;
  state.activeEditable = Boolean(payload.editable);
  state.savedContent = payload.content;
  dom.editorTitle.dataset.baseTitle = file.label;
  dom.editorTitle.textContent = file.label;
  dom.editorPath.textContent = `${formatDisplayPath(file.path)} | ${payload.editable ? "Editable source" : "Read-only generated view"}`;
  dom.editorPath.title = file.path;
  dom.editor.value = payload.content;
  dom.editor.readOnly = !payload.editable;
  state.dirtyPaths.delete(file.path);
  updateEditorChrome();
  renderFileList(state.snapshot.managedFiles);

  if (activateSection) {
    setActiveSection("files");
  }
}

function focusFile(filePath) {
  const file = state.snapshot.managedFiles.find((entry) => entry.path === filePath);
  if (!file) return;
  loadFile(file, { activateSection: true }).catch((error) => {
    setActionStatus(error.message, "error");
  });
}

async function saveCurrentFile() {
  if (!state.activePath || !state.activeEditable) return;

  const payload = await request("/api/file", {
    method: "PUT",
    body: JSON.stringify({
      path: state.activePath,
      content: dom.editor.value
    })
  });

  const renderedMessage = payload.rendered?.length
    ? ` Rendered ${payload.rendered.length} effective instruction file(s).`
    : "";
  state.savedContent = dom.editor.value;
  state.dirtyPaths.delete(state.activePath);
  updateEditorChrome();
  setActionStatus(`Saved ${payload.path} at ${payload.savedAt}.${renderedMessage}`, "success");
  await refreshState();
}

function discardCurrentChanges() {
  if (!state.activeEditable || !state.activePath || !isActiveFileDirty()) return;

  dom.editor.value = state.savedContent;
  state.dirtyPaths.delete(state.activePath);
  updateEditorChrome();
  renderFileList(state.snapshot?.managedFiles || []);
  setActionStatus(`Discarded unsaved changes in ${state.activePath}.`, "success");
}

async function runAction(endpoint, body = {}) {
  setActiveSection("operations");
  setActionStatus("Running...", "pending");
  setOperationStatus("Running...", "pending");

  const payload = await request(endpoint, {
    method: "POST",
    body: JSON.stringify(body)
  });
  setOperationStatus(payload.output || "Action completed.", "success");
  setActionStatus(payload.output || "Action completed.", "success");
  await refreshState();
}

async function withBusy(task) {
  setBusy(true);
  try {
    await task();
  } finally {
    setBusy(false);
  }
}

async function applyInitialRoute(snapshot) {
  if (state.initialRouteApplied || state.activeSection !== "files") {
    state.initialRouteApplied = true;
    return;
  }

  const candidates = snapshot.managedFiles || [];
  const requestedFile = state.initialFilePath
    ? candidates.find((file) => file.path === state.initialFilePath)
    : null;
  const toolScopedFile = state.selectedToolId
    ? candidates.find((file) => file.cliTargets?.includes(state.selectedToolId) && file.editable)
    : null;
  const defaultFile = candidates.find((file) => file.editable) || candidates[0] || null;
  const fileToLoad = requestedFile || toolScopedFile || defaultFile;

  state.initialRouteApplied = true;
  if (fileToLoad) {
    await loadFile(fileToLoad, { activateSection: false });
  }
}

async function refreshState({ announce = false } = {}) {
  const snapshot = await request("/api/state");
  state.snapshot = snapshot;

  if (!snapshot.tools.some((tool) => tool.id === state.selectedToolId)) {
    state.selectedToolId = getDefaultToolId(snapshot.tools);
  }

  dom.generatedAt.textContent = `Snapshot: ${snapshot.generatedAt} | Global Superpowers: ${snapshot.globalSuperpowersVisibility}`;
  renderHeroStats(buildHeroStats(snapshot));
  renderWarnings(snapshot.warnings);
  renderProfiles(snapshot);
  renderFileList(snapshot.managedFiles);
  renderBench(snapshot.capabilityBench || []);
  syncActionButtons();
  await applyInitialRoute(snapshot);

  if (state.activePath && snapshot.managedFiles.some((file) => file.path === state.activePath)) {
    const active = snapshot.managedFiles.find((file) => file.path === state.activePath);
    if (isActiveFileDirty()) {
      state.activeEditable = Boolean(active.editable);
      dom.editorTitle.dataset.baseTitle = active.label;
      dom.editorPath.textContent = `${formatDisplayPath(active.path)} | ${active.editable ? "Editable source" : "Read-only generated view"}`;
      dom.editorPath.title = active.path;
      dom.editor.readOnly = !active.editable;
      updateEditorChrome();
    } else {
      await loadFile(active, { activateSection: false });
    }
  } else if (!state.activePath) {
    resetEditor();
  } else {
    resetEditor();
  }

  setActiveSection(state.activeSection);

  if (announce) {
    setActionStatus("Snapshot refreshed.", "success");
  }
}

dom.saveFile.addEventListener("click", () => {
  withBusy(saveCurrentFile).catch((error) => {
    setActionStatus(error.message, "error");
  });
});

dom.discardFile.addEventListener("click", () => {
  discardCurrentChanges();
});

dom.refreshState.addEventListener("click", () => {
  setActionStatus("Refreshing snapshot...", "pending");
  withBusy(() => refreshState({ announce: true })).catch((error) => {
    setActionStatus(error.message, "error");
  });
});

dom.bootstrapHome.addEventListener("click", () => {
  withBusy(() => runAction("/api/action/bootstrap-home")).catch((error) => {
    setActionStatus(error.message, "error");
  });
});

dom.pluginModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    withBusy(() => runAction("/api/action/opencode-plugin", { mode: button.dataset.pluginMode })).catch((error) => {
      setOperationStatus(error.message, "error");
      setActionStatus(error.message, "error");
    });
  });
});

dom.codexModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    withBusy(() => runAction("/api/action/codex-orchestrator", { mode: button.dataset.codexMode })).catch((error) => {
      setOperationStatus(error.message, "error");
      setActionStatus(error.message, "error");
    });
  });
});

dom.visibilityModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    withBusy(() => runAction("/api/action/global-superpowers-visibility", { mode: button.dataset.visibilityMode })).catch((error) => {
      setOperationStatus(error.message, "error");
      setActionStatus(error.message, "error");
    });
  });
});

dom.editor.addEventListener("input", () => {
  if (!state.activeEditable || !state.activePath) return;
  markDirtyState(dom.editor.value !== state.savedContent);
});

dom.fileSearch.addEventListener("input", (event) => {
  state.searchTerm = event.target.value.trim().toLowerCase();
  renderFileList(state.snapshot?.managedFiles || []);
});

dom.railButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveSection(button.dataset.sectionTarget);
  });
});

setBusy(false);
setActiveSection(state.activeSection);
resetEditor();
setActionStatus("Idle. Ready.", "idle");
setOperationStatus("Run an operation from this panel.", "idle");

withBusy(refreshState).catch((error) => {
  setOperationStatus(error.message, "error");
  setActionStatus(error.message, "error");
});
