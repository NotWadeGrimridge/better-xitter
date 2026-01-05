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
