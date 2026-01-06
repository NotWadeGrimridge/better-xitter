/// <reference lib="dom" />

export function isInHomeTimeline(element: Element): boolean {
  return Boolean(
    element.closest('div[aria-label="Timeline: Your Home Timeline"]'),
  );
}

export function normalizeHandleList(input: string): string[] {
  return input
    .split(",")
    .map((part) => {
      let normalized = part.trim();
      for (; normalized.startsWith("@"); normalized = normalized.slice(1));
      return normalized.toLowerCase();
    })
    .filter((part) => part.length > 0);
}

export function getPath(
  value: unknown,
  path: readonly (string | number)[],
): unknown {
  let current: unknown = value;
  for (const segment of path) {
    if (typeof segment === "number") {
      if (!Array.isArray(current)) return undefined;
      current = current[segment];
      continue;
    }
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
