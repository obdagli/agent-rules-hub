export function stripJsonc(input) {
  return input
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/,\s*([}\]])/g, "$1");
}

export function parseJsonc(input) {
  try {
    return {
      data: JSON.parse(stripJsonc(input)),
      error: null
    };
  } catch (error) {
    return {
      data: {},
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function stringifyJsonc(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}
