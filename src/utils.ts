export function isInHomeTimeline(element: Element): boolean {
  return Boolean(
    element.closest('div[aria-label="Timeline: Your Home Timeline"]'),
  );
}

export function normalizeHandleList(input: string): string[] {
  return input
    .split(",")
    .map((part) => {
      const normalized = part.trim().replace(/^@+/, "");
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

export function getCookie(name: string): string | null {
  const match = `; ${document.cookie}`.match(`;\\s*${name}=([^;]+)`);
  return match ? match[1] : null;
}

export async function fetchGraphqlJson(
  relativeOrAbsoluteUrl: string,
): Promise<unknown | null> {
  const csrfToken = getCookie("ct0");

  const headers: Record<string, string> = {
    "authorization":
      "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
    "content-type": "application/json",
    "x-twitter-active-user": "yes",
    "x-twitter-auth-type": "OAuth2Session",
    "x-twitter-client-language": document.documentElement.lang || "en",
  };
  if (csrfToken) {
    headers["x-csrf-token"] = csrfToken;
  }

  const url = new URL(
    relativeOrAbsoluteUrl,
    globalThis.location.origin,
  );

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      credentials: "include",
      headers,
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return response.json();
}
