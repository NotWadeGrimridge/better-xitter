/// <reference lib="dom" />

(() => {
  const hookFlag = "__betterXitterAffiliatesPageXhrHookInstalled";
  const teamTimelineGraphqlPath =
    "/i/api/graphql/WFHHTYX3ZGPBD_3G3nDuGw/UserBusinessProfileTeamTimeline";

  const win = globalThis as unknown as Record<string, unknown>;
  if (win[hookFlag] === true) return;
  win[hookFlag] = true;

  type HeaderPair = [string, string];
  const recordedHeaders = new WeakMap<XMLHttpRequest, HeaderPair[]>();
  let hasReplayedFirstRequest = false;

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

  // Note: we deliberately do NOT override `XMLHttpRequest.prototype.send` or
  // `setRequestHeader` so unrelated XHRs don't show this file as the initiator.

  function replayTeamTimelineRequest(input: {
    method: string;
    url: string;
    headers: HeaderPair[];
  }): void {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open(input.method, input.url);
      for (const [name, value] of input.headers) {
        try {
          xhr.setRequestHeader(name, value);
        } catch {
          // ignore invalid header sets
        }
      }

      xhr.addEventListener("load", () => {
        let payload: unknown = xhr.responseText;
        if (!payload) return;
        try {
          payload = JSON.parse(String(payload));
        } catch {
          return;
        }

        const users = extractUsersFromTeamTimeline(payload);
        console.log("[better-xitter] affiliates users:", users);
        globalThis.postMessage(
          {
            type: "better-xitter:affiliates-users",
            users,
          },
          "*",
        );
      });

      xhr.send();
    } catch (error) {
      console.warn(
        "[better-xitter] Failed to replay affiliates request",
        error,
      );
    }
  }

  function isAffiliatesPagePath(pathname: string): boolean {
    let path = pathname;
    while (path.startsWith("/")) path = path.slice(1);
    while (path.endsWith("/")) path = path.slice(0, -1);
    const segments = path.split("/").filter(Boolean);
    return segments.length === 2 && segments[1] === "affiliates";
  }

  function isTargetGraphqlRequest(url: string): boolean {
    if (!isAffiliatesPagePath(globalThis.location?.pathname ?? "")) {
      return false;
    }
    try {
      const parsed = new URL(
        url,
        globalThis.location?.origin ?? "https://x.com",
      );
      return parsed.pathname === teamTimelineGraphqlPath;
    } catch {
      return false;
    }
  }

  function buildCountOverrideUrl(
    originalUrl: string,
    count: number,
  ): string | null {
    try {
      const url = new URL(
        originalUrl,
        globalThis.location?.origin ?? "https://x.com",
      );
      if (url.pathname !== teamTimelineGraphqlPath) return null;

      const variablesRaw = url.searchParams.get("variables");
      if (!variablesRaw) return null;

      let variables: Record<string, unknown>;
      try {
        variables = JSON.parse(variablesRaw) as Record<string, unknown>;
      } catch {
        return null;
      }
      variables.count = count;
      url.searchParams.set("variables", JSON.stringify(variables));
      return url.toString();
    } catch {
      return null;
    }
  }

  type PathSegment = string | number;

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  function get(value: unknown, path: readonly PathSegment[]): unknown {
    let current: unknown = value;
    for (const segment of path) {
      if (typeof segment === "number") {
        if (!Array.isArray(current)) return undefined;
        current = current[segment];
        continue;
      }
      if (!isRecord(current)) return undefined;
      current = current[segment];
    }
    return current;
  }

  function extractUsersFromTeamTimeline(payload: unknown): Array<{
    rest_id: string;
    screen_name: string;
    name?: string;
    avatar_url?: string;
    affiliate_label_url?: string;
  }> {
    const instructions = get(payload, [
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
        const user = get(entry, [
          "content",
          "itemContent",
          "user_results",
          "result",
        ]);
        if (!isRecord(user)) continue;

        const rest_id = user.rest_id;
        const screen_name = get(user, ["core", "screen_name"]);
        if (typeof rest_id !== "string" || typeof screen_name !== "string") {
          continue;
        }

        const name = get(user, ["core", "name"]);
        const avatar_url = get(user, ["avatar", "image_url"]);
        const affiliate_label_url = get(user, [
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
