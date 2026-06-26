import { isAffiliatesPathname } from "./shared.ts";
import { fetchGraphqlJson, getPath } from "@/utils.ts";

(() => {
  const hookFlag = "__betterXitterAffiliatesPageXhrHookInstalled";

  const win = window as unknown as Record<string, unknown>;
  if (win[hookFlag] === true) return;
  win[hookFlag] = true;

  let hasReplayedFirstRequest = false;
  let lastUserIds: string[] = [];
  let hasSeenResponse = false;

  const XHR = XMLHttpRequest.prototype;

  const originalOpen = XHR.open as unknown as (
    this: XMLHttpRequest,
    ...args: unknown[]
  ) => void;

  XHR.open = function (this: XMLHttpRequest, ...args: unknown[]) {
    const urlArg = args[1];
    const url = typeof urlArg === "string"
      ? urlArg
      : urlArg instanceof URL
      ? urlArg.toString()
      : "";

    if (!hasReplayedFirstRequest && isTargetGraphqlRequest(url)) {
      const instanceOriginalSend = this.send.bind(this);
      const replayUrl = buildCountOverrideUrl(url, 1000);

      this.send = function (
        this: XMLHttpRequest,
        ...sendArgs: unknown[]
      ): void {
        if (!hasReplayedFirstRequest) {
          hasReplayedFirstRequest = true;
          if (replayUrl) {
            replayTeamTimelineRequest(replayUrl);
          }
        }
        return (instanceOriginalSend as (...args: unknown[]) => void)(
          ...sendArgs,
        );
      };
    }

    return originalOpen.apply(this, args);
  };

  addEventListener("message", (event: MessageEvent) => {
    const data = event.data as Record<string, unknown> | null;
    if (!data) return;
    if (data.type !== "better-xitter:affiliates-mute-ready") return;
    if (!hasSeenResponse) return;
    postMessage(
      {
        type: "better-xitter:affiliates-users",
        userIds: lastUserIds,
      },
      "*",
    );
  });

  async function replayTeamTimelineRequest(url: string): Promise<void> {
    const payload = await fetchGraphqlJson(url);
    if (!payload) return;

    const userIds = extractUserIdsFromTeamTimeline(payload);
    lastUserIds = userIds;
    hasSeenResponse = true;

    postMessage(
      {
        type: "better-xitter:affiliates-users",
        userIds,
      },
      "*",
    );
  }

  function isTargetGraphqlRequest(url: string): boolean {
    if (!isAffiliatesPathname(location.pathname)) {
      return false;
    }

    let parsed: URL;
    try {
      parsed = new URL(
        url,
        location.origin,
      );
    } catch {
      return false;
    }

    const pathname = parsed.pathname;
    return pathname.includes("/graphql/") &&
      pathname.endsWith("/UserBusinessProfileTeamTimeline");
  }

  function buildCountOverrideUrl(
    originalUrl: string,
    count: number,
  ): string | null {
    let url: URL;
    try {
      url = new URL(
        originalUrl,
        location.origin,
      );
    } catch {
      return null;
    }

    const pathname = url.pathname;
    const isTeamTimelinePath = pathname.includes("/graphql/") &&
      pathname.endsWith("/UserBusinessProfileTeamTimeline");
    if (!isTeamTimelinePath) return null;

    const variablesRaw = url.searchParams.get("variables");
    if (!variablesRaw) return null;

    let variables: Record<string, unknown>;
    try {
      const parsed = JSON.parse(variablesRaw);
      if (typeof parsed !== "object" || parsed === null) return null;
      variables = parsed as Record<string, unknown>;
    } catch {
      return null;
    }

    variables.count = count;
    url.searchParams.set("variables", JSON.stringify(variables));
    return url.toString();
  }

  function extractUserIdsFromTeamTimeline(payload: unknown): string[] {
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
      const entries = (instruction as Record<string, unknown> | null)?.entries;
      if (!Array.isArray(entries)) continue;

      for (const entry of entries) {
        const user = getPath(entry, [
          "content",
          "itemContent",
          "user_results",
          "result",
        ]);
        if (typeof user !== "object" || user === null) continue;

        const rest_id = (user as Record<string, unknown>).rest_id;
        if (typeof rest_id !== "string") continue;
        userIds.add(rest_id);
      }
    }

    return [...userIds];
  }
})();
