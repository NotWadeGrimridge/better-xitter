export const BEARER_TOKEN =
  "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

export const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export const MUTE_ICON_PATH =
  "M18 6.59V1.2L8.71 7H5.5C4.12 7 3 8.12 3 9.5v5C3 15.88 4.12 17 5.5 17h2.09l-2.3 2.29 1.42 1.42 15.5-15.5-1.42-1.42L18 6.59zm-8 8V8.55l6-3.75v3.79l-6 6zM5 9.5c0-.28.22-.5.5-.5H8v6H5.5c-.28 0-.5-.22-.5-.5v-5zm6.5 9.24l1.45-1.45L16 19.2V14l2 .02v8.78l-6.5-4.06z";

export function isInHomeTimeline(element: Element): boolean {
  return Boolean(
    element.closest('div[aria-label="Timeline: Your Home Timeline"]'),
  );
}

export function isAffiliatesPathname(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 2 && segments[1] === "affiliates";
}

export function normalizeHandleList(input: string): string[] {
  return input
    .split(",")
    .map((part) => part.trim().replace(/^@+/u, "").toLowerCase())
    .filter(Boolean);
}

export function getPath(
  value: unknown,
  path: readonly (string | number)[],
): unknown {
  let current = value;

  for (const segment of path) {
    const canDescend = typeof segment === "number"
      ? Array.isArray(current)
      : typeof current === "object" && current !== null;
    if (!canDescend) return null;

    current = (current as Record<string | number, unknown>)[segment];
  }

  return current;
}

export function getCookie(name: string): string | null {
  return document.cookie.match(`(?:^|;\\s*)${name}=([^;]+)`)?.[1] ?? null;
}

export async function fetchGraphqlJson(url: string): Promise<unknown> {
  const headers: Record<string, string> = {
    "authorization": BEARER_TOKEN,
    "content-type": "application/json",
    "x-twitter-active-user": "yes",
    "x-twitter-auth-type": "OAuth2Session",
    "x-twitter-client-language": document.documentElement.lang || "en",
  };

  const csrfToken = getCookie("ct0");
  if (csrfToken) headers["x-csrf-token"] = csrfToken;

  try {
    const response = await fetch(new URL(url, location.origin), {
      credentials: "include",
      headers,
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}
