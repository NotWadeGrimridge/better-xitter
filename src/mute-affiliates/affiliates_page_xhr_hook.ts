import { fetchGraphqlJson, getPath, isAffiliatesPathname } from "@/utils.ts";

// Runs in the page's main world. When an affiliates page asks for its first
// page of affiliates, fetch the same query again with a large count, so the
// content script gets every affiliate of that org at once.
((): void => {
  const INSTALLED_FLAG = "__betterXitterAffiliatesPageXhrHookInstalled";
  const REPLAY_COUNT = 1000;

  const page = globalThis as unknown as Record<string, unknown>;
  if (page[INSTALLED_FLAG]) return;
  page[INSTALLED_FLAG] = true;

  const replayedPathnames = new Set<string>();
  const userIdsByPathname = new Map<string, string[]>();

  const originalOpen = XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open = function open(
    this: XMLHttpRequest,
    ...args: [method: string, url: string | URL, ...rest: unknown[]]
  ): void {
    const url = URL.parse(args[1], location.origin);
    const { pathname } = location;

    if (
      url && isAffiliatesPathname(pathname) &&
      !replayedPathnames.has(pathname) &&
      url.pathname.includes("/graphql/") &&
      url.pathname.endsWith("/UserBusinessProfileTeamTimeline")
    ) {
      const send = this.send.bind(this);

      this.send = (body): void => {
        if (!replayedPathnames.has(pathname)) {
          replayedPathnames.add(pathname);
          replayWithLargeCount(url, pathname);
        }
        send(body);
      };
    }

    Reflect.apply(originalOpen, this, args);
  };

  addEventListener("message", (event: MessageEvent) => {
    if (event.data?.type !== "better-xitter:affiliates-mute-ready") return;

    for (const [pathname, userIds] of userIdsByPathname) {
      postUserIds(pathname, userIds);
    }
  });

  function postUserIds(pathname: string, userIds: string[]): void {
    postMessage(
      { type: "better-xitter:affiliates-users", pathname, userIds },
      "*",
    );
  }

  async function replayWithLargeCount(
    url: URL,
    pathname: string,
  ): Promise<void> {
    const variables = parseVariables(url.searchParams.get("variables"));
    if (!variables) return;

    const replayUrl = new URL(url);
    replayUrl.searchParams.set(
      "variables",
      JSON.stringify({ ...variables, count: REPLAY_COUNT }),
    );

    const payload = await fetchGraphqlJson(replayUrl.toString());
    if (!payload) return;

    const userIds = extractUserIds(payload);
    userIdsByPathname.set(pathname, userIds);
    postUserIds(pathname, userIds);
  }

  function parseVariables(raw: string | null): object | null {
    if (!raw) return null;

    try {
      const variables: unknown = JSON.parse(raw);
      return typeof variables === "object" ? variables : null;
    } catch {
      return null;
    }
  }

  function extractUserIds(payload: unknown): string[] {
    const instructions = getPath(payload, [
      "data",
      "user",
      "result",
      "timeline",
      "timeline",
      "instructions",
    ]);
    if (!Array.isArray(instructions)) return [];

    const userIds = new Set<string>();

    for (const instruction of instructions) {
      const entries = getPath(instruction, ["entries"]);
      if (!Array.isArray(entries)) continue;

      for (const entry of entries) {
        const userId = getPath(entry, [
          "content",
          "itemContent",
          "user_results",
          "result",
          "rest_id",
        ]);
        if (typeof userId === "string") userIds.add(userId);
      }
    }

    return [...userIds];
  }
})();
