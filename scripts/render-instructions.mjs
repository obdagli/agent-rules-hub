import { renderAllInstructions } from "../lib/instructions.mjs";

const rendered = await renderAllInstructions();

for (const entry of rendered) {
  console.log(`rendered ${entry.toolId}: ${entry.outputPath}`);
}
