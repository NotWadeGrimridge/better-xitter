import { AffiliatesUser, isAffiliatesPathname } from "./shared.ts";
import { fetchGraphqlJson, getPath } from "@/utils.ts";

(() => {
  const hookFlag = "__betterXitterAffiliatesPageXhrHookInstalled";

  const win = window as unknown as Record<string, unknown>;
  if (win[hookFlag] === true) return;
  win[hookFlag] = true;

  type HeaderPair = [string, string];
  const hookedXhrs = new WeakSet<XMLHttpRequest>();
  const firstUrls = new WeakMap<XMLHttpRequest, string>();
  const firstMethods = new WeakMap<XMLHttpRequest, string>();
  const recordedHeaders = new WeakMap<XMLHttpRequest, HeaderPair[]>();
  let hasReplayedFirstRequest = false;
  let lastUsers: AffiliatesUser[] = [];
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
      const xhr = this as XMLHttpRequest;

      hookedXhrs.add(xhr);
      firstUrls.set(xhr, url);
      const methodArg = args[0];
      firstMethods.set(xhr, typeof methodArg === "string" ? methodArg : "GET");
      recordedHeaders.set(xhr, []);

      const instanceOriginalSetRequestHeader = xhr.setRequestHeader.bind(xhr);
      const instanceOriginalSend = xhr.send.bind(xhr);

      xhr.setRequestHeader = function (
        this: XMLHttpRequest,
        name: string,
        value: string,
      ): void {
        if (hookedXhrs.has(this)) {
          recordedHeaders.get(this)?.push([name, value]);
        }
        return instanceOriginalSetRequestHeader(name, value);
      };

      xhr.send = function (this: XMLHttpRequest, ...sendArgs: unknown[]): void {
        if (hookedXhrs.has(this) && !hasReplayedFirstRequest) {
          hasReplayedFirstRequest = true;
          const method = firstMethods.get(this) ?? "GET";
          const firstUrl = firstUrls.get(this);
          const headers = recordedHeaders.get(this) ?? [];
          if (firstUrl) {
            const replayUrl = buildCountOverrideUrl(firstUrl, 1000);
            if (replayUrl) {
              replayTeamTimelineRequest({ method, url: replayUrl, headers });
            }
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
        users: lastUsers,
      },
      "*",
    );
  });

  async function replayTeamTimelineRequest(input: {
    method: string;
    url: string;
    headers: HeaderPair[];
  }): Promise<void> {
    const payload = await fetchGraphqlJson(input.url);
    if (!payload) return;

    const users = extractUsersFromTeamTimeline(payload);
    lastUsers = users;
    hasSeenResponse = true;

    postMessage(
      {
        type: "better-xitter:affiliates-users",
        users,
      },
      "*",
    );
  }

  function isTargetGraphqlRequest(url: string): boolean {
    if (!isAffiliatesPathname(location.pathname)) {
      return false;
    }
    const parsed = new URL(
      url,
      location.origin,
    );
    const pathname = parsed.pathname;
    return pathname.includes("/graphql/") &&
      pathname.endsWith("/UserBusinessProfileTeamTimeline");
  }

  function buildCountOverrideUrl(
    originalUrl: string,
    count: number,
  ): string | null {
    const url = new URL(
      originalUrl,
      location.origin,
    );
    const pathname = url.pathname;
    const isTeamTimelinePath = pathname.includes("/graphql/") &&
      pathname.endsWith("/UserBusinessProfileTeamTimeline");
    if (!isTeamTimelinePath) return null;

    const variablesRaw = url.searchParams.get("variables");
    if (!variablesRaw) return null;

    const variables = JSON.parse(variablesRaw) as Record<string, unknown>;
    variables.count = count;
    url.searchParams.set("variables", JSON.stringify(variables));
    return url.toString();
  }

  function extractUsersFromTeamTimeline(payload: unknown): AffiliatesUser[] {
    const instructions = getPath(payload, [
      "data",
      "user",
      "result",
      "timeline",
      "timeline",
      "instructions",
    ]);
    if (!Array.isArray(instructions)) return [];

    const byRestId = new Map<string, {
      rest_id: string;
      screen_name: string;
      name?: string;
      avatar_url?: string;
      affiliate_label_url?: string;
    }>();

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
        const screen_name = getPath(user, ["core", "screen_name"]);
        if (typeof rest_id !== "string" || typeof screen_name !== "string") {
          continue;
        }

        const name = getPath(user, ["core", "name"]);
        const avatar_url = getPath(user, ["avatar", "image_url"]);
        const affiliate_label_url = getPath(user, [
          "affiliates_highlighted_label",
          "label",
          "url",
          "url",
        ]);

        if (!byRestId.has(rest_id)) {
          byRestId.set(rest_id, {
            rest_id,
            screen_name,
            name: typeof name === "string" ? name : undefined,
            avatar_url: typeof avatar_url === "string" ? avatar_url : undefined,
            affiliate_label_url: typeof affiliate_label_url === "string"
              ? affiliate_label_url
              : undefined,
          });
        }
      }
    }

    return [...byRestId.values()];
  }
})();
