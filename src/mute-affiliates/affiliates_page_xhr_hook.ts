/// <reference lib="dom" />

import { AffiliatesUser, isAffiliatesPathname } from "./shared.ts";
import { fetchGraphqlJson, getPath } from "@/utils.ts";

(() => {
  const hookFlag = "__betterXitterAffiliatesPageXhrHookInstalled";

  const win = globalThis as unknown as Record<string, unknown>;
  if (win[hookFlag] === true) return;
  win[hookFlag] = true;

  type HeaderPair = [string, string];
  const recordedHeaders = new WeakMap<XMLHttpRequest, HeaderPair[]>();
  let hasReplayedFirstRequest = false;
  let lastUsers: AffiliatesUser[] = [];
  let hasSeenResponse = false;

  const XHR = XMLHttpRequest.prototype as XMLHttpRequest & {
    __betterXitterAffiliatesHooked?: boolean;
    __betterXitterAffiliatesFirstUrl?: string;
    __betterXitterAffiliatesFirstMethod?: string;
  };

  const originalOpen = XHR.open as unknown as (
    this: XMLHttpRequest,
    ...args: unknown[]
  ) => void;

  void XHR.setRequestHeader;
  void XHR.send;

  XHR.open = function (this: XMLHttpRequest, ...args: unknown[]) {
    const urlArg = args[1];
    const url = typeof urlArg === "string"
      ? urlArg
      : urlArg instanceof URL
      ? urlArg.toString()
      : "";

    if (!hasReplayedFirstRequest && isTargetGraphqlRequest(url)) {
      const typed = this as typeof XHR & {
        setRequestHeader: XMLHttpRequest["setRequestHeader"];
        send: XMLHttpRequest["send"];
      };

      typed.__betterXitterAffiliatesHooked = true;
      typed.__betterXitterAffiliatesFirstUrl = url;
      const methodArg = args[0];
      typed.__betterXitterAffiliatesFirstMethod = typeof methodArg === "string"
        ? methodArg
        : "GET";
      recordedHeaders.set(this, []);

      const instanceOriginalSetRequestHeader = typed.setRequestHeader;
      typed.setRequestHeader = function (
        this: XMLHttpRequest,
        ...headerArgs: unknown[]
      ) {
        const typedThis = this as typeof XHR;
        if (
          typedThis.__betterXitterAffiliatesHooked && headerArgs.length >= 2
        ) {
          const [nameArg, valueArg] = headerArgs;
          if (typeof nameArg === "string" && typeof valueArg === "string") {
            recordedHeaders.get(this)?.push([nameArg, valueArg]);
          }
        }
        return (instanceOriginalSetRequestHeader as unknown as (
          this: XMLHttpRequest,
          ...args: unknown[]
        ) => void).apply(this, headerArgs);
      };

      const instanceOriginalSend = typed.send;
      typed.send = function (this: XMLHttpRequest, ...sendArgs: unknown[]) {
        const sendTyped = this as typeof XHR;
        if (
          sendTyped.__betterXitterAffiliatesHooked && !hasReplayedFirstRequest
        ) {
          hasReplayedFirstRequest = true;

          const method = sendTyped.__betterXitterAffiliatesFirstMethod ?? "GET";
          const firstUrl = sendTyped.__betterXitterAffiliatesFirstUrl ?? null;
          const headers = recordedHeaders.get(this) ?? [];
          if (firstUrl) {
            const replayUrl = buildCountOverrideUrl(firstUrl, 1000);
            if (replayUrl) {
              replayTeamTimelineRequest({ method, url: replayUrl, headers });
            }
          }
        }
        return (instanceOriginalSend as unknown as (
          this: XMLHttpRequest,
          ...args: unknown[]
        ) => void).apply(this, sendArgs);
      };
    }

    return originalOpen.apply(this, args);
  };

  globalThis.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as Record<string, unknown> | null;
    if (!data) return;
    if (data.type !== "better-xitter:affiliates-mute-ready") return;
    if (!hasSeenResponse) return;
    globalThis.postMessage(
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

    globalThis.postMessage(
      {
        type: "better-xitter:affiliates-users",
        users,
      },
      "*",
    );
  }

  function isTargetGraphqlRequest(url: string): boolean {
    if (!isAffiliatesPathname(globalThis.location?.pathname ?? "")) {
      return false;
    }
    const parsed = new URL(
      url,
      globalThis.location?.origin ?? "https://x.com",
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
      globalThis.location?.origin ?? "https://x.com",
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
