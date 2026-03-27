function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function formatDisplayPath(value = "") {
  const raw = String(value ?? "");
  if (!raw) return "";

  if (!raw.includes("/") && !raw.startsWith("~")) {
    return raw;
  }

  const compactHome = raw.replace(/^\/home\/[^/]+/, "~");
  if (compactHome.length <= 56) {
    return compactHome;
  }

  const segments = compactHome.split("/");
  if (segments.length < 6) {
    return compactHome;
  }

  return `${segments.slice(0, 3).join("/")}/.../${segments.slice(-3).join("/")}`;
}

export function buildHeroStats(snapshot = {}) {
  const tools = asArray(snapshot.tools);
  const managedFiles = asArray(snapshot.managedFiles);
  const warnings = asArray(snapshot.warnings);
  const discoverySummary = snapshot.discoverySummary || {};

  const stats = [
    { label: "Active CLIs", value: String(tools.length).padStart(2, "0") },
    { label: "Editable Files", value: String(managedFiles.length).padStart(2, "0") },
    { label: "Warnings", value: String(warnings.length).padStart(2, "0") }
  ];

  if (typeof discoverySummary.rules === "number") {
    stats.push({ label: "Rules Found", value: String(discoverySummary.rules).padStart(2, "0") });
  }

  if (typeof discoverySummary.skills === "number") {
    stats.push({ label: "Skills Found", value: String(discoverySummary.skills).padStart(2, "0") });
  }

  return stats;
}

export function getDefaultToolId(tools = []) {
  const statusOrder = ["managed", "detected", "broken", "supported", "experimental", "invalid"];

  return (
    statusOrder.map((status) => tools.find((tool) => tool.profileStatus?.status === status)?.id).find(Boolean) ||
    tools[0]?.id || null
  );
}

export function buildProfileWorkspaceModel(snapshot = {}, selectedToolId = null) {
  const tools = asArray(snapshot.tools);
  const preferredToolId = selectedToolId && tools.some((tool) => tool.id === selectedToolId)
    ? selectedToolId
    : getDefaultToolId(tools);
  const activeToolId = preferredToolId;
  const activeTool = tools.find((tool) => tool.id === activeToolId) || tools[0] || null;

  return {
    activeTool,
    cards: tools.map((tool) => ({
      id: tool.id,
      label: tool.label,
      status: tool.profileStatus?.status || "unknown",
      summary: tool.profileStatus?.summary || ""
    }))
  };
}

export function buildFileWorkspaceModel(files = [], searchTerm = "", dirtyPaths = []) {
  const term = searchTerm.trim().toLowerCase();
  const dirtySet = new Set(asArray(dirtyPaths));
  const groups = new Map();
  let totalMatches = 0;

  for (const file of asArray(files)) {
    if (term) {
      const haystack = `${file.label} ${file.group} ${file.path}`.toLowerCase();
      if (!haystack.includes(term)) continue;
    }

    if (!groups.has(file.group)) groups.set(file.group, []);
    groups.get(file.group).push({
      ...file,
      dirty: dirtySet.has(file.path)
    });
    totalMatches += 1;
  }

  return {
    groups,
    totalMatches,
    isFiltered: Boolean(term)
  };
}
