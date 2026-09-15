export const FORGE_API_VERSION = "0.1.0" as const;

const RANGE_PATTERN = /^([\^~])?(\d+)\.(\d+)\.(\d+)$/;
const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

function parseTriple(value: string): [number, number, number] | undefined {
  const match = VERSION_PATTERN.exec(value);
  if (!match) {
    return undefined;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function cmp(a: [number, number, number], b: [number, number, number]): number {
  if (a[0] !== b[0]) {
    return a[0] - b[0];
  }
  if (a[1] !== b[1]) {
    return a[1] - b[1];
  }
  return a[2] - b[2];
}

export function forgeApiSatisfied(
  range: string,
  version: string = FORGE_API_VERSION,
): boolean {
  const current = parseTriple(version);
  const rangeMatch = RANGE_PATTERN.exec(range);
  if (!current || !rangeMatch) {
    return false;
  }

  const operator = rangeMatch[1];
  const target: [number, number, number] = [
    Number(rangeMatch[2]),
    Number(rangeMatch[3]),
    Number(rangeMatch[4]),
  ];

  if (operator === undefined) {
    return cmp(current, target) === 0;
  }

  if (cmp(current, target) < 0) {
    return false;
  }

  if (operator === "~") {
    return current[0] === target[0] && current[1] === target[1];
  }

  if (target[0] === 0) {
    return current[0] === 0 && current[1] === target[1];
  }

  return current[0] === target[0];
}
