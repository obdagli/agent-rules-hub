#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

node --input-type=module <<EOF
import { buildDashboardState } from "${repo_root}/lib/state.mjs";

const state = await buildDashboardState();

console.log(\`Shared skill discovery: \${state.globalSuperpowersVisibility}\`);
console.log("");

for (const tool of state.tools) {
  console.log(\`\${tool.label}\`);
  console.log(\`  Status: \${tool.profileStatus.status}\`);
  console.log(\`  Summary: \${tool.profileStatus.summary}\`);
  console.log(\`  Preferred profile: \${tool.preferredProfile}\`);
  console.log(\`  Generated file: \${tool.syncState.generatedPath}\`);
  console.log(\`  Home path: \${tool.syncState.homePath}\`);
  console.log(\`  Resolved path: \${tool.syncState.resolvedPath}\`);
  console.log(\`  Capabilities: \${tool.capabilities.join(", ") || "None"}\`);
  console.log("");
}
EOF
