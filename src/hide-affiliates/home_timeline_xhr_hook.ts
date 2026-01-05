/// <reference lib="dom" />

(() => {
  const hookFlag = "__betterXitterHomeTimelineXhrHookInstalled";
  const homeTimelineGraphqlPath =
    "/i/api/graphql/edseUwk9sP5Phz__9TIRnA/HomeTimeline";
  const maxBufferedPairs = 5000;

  const win = globalThis as unknown as Record<string, unknown>;
  if (win[hookFlag] === true) return;
  win[hookFlag] = true;

  // This script runs in the page's MAIN world (not the extension content-script world).
  // We patch XHR here because content scripts run in an isolated world and cannot
  // monkeypatch the page's own XMLHttpRequest/fetch implementations.
  //
  // We also implement a small "ready/replay" handshake with the content script:
  // the page can emit affiliation pairs before the content script installs its
  // `message` listener (postMessage has no buffering), so we cache and replay once
  // the content script signals readiness.
  type Pair = [string, string];

  let affiliateReady = false;
  let bufferedPairs: Pair[] = [];

  const XHR = XMLHttpRequest.prototype as XMLHttpRequest & {
    __betterXitterHomeTimelineHooked?: boolean;
  };

  const originalOpen = XHR.open as unknown as (
    this: XMLHttpRequest,
    ...args: unknown[]
  ) => void;

  XHR.open = function (...args: unknown[]) {
    const urlArg = args[1];
    const url = typeof urlArg === "string"
      ? urlArg
      : urlArg instanceof URL
      ? urlArg.toString()
      : "";

    let isHomeTimeline = false;
    try {
      isHomeTimeline = new URL(
        url,
        globalThis.location?.origin ?? "https://x.com",
      ).pathname === homeTimelineGraphqlPath;
    } catch {
      // ignore
    }
    if (isHomeTimeline && !this.__betterXitterHomeTimelineHooked) {
      this.__betterXitterHomeTimelineHooked = true;
      this.addEventListener("load", () => {
        let payload: unknown;
        if (this.responseType === "json") {
          payload = this.response;
        } else {
          const text = this.responseText;
          if (!text) return;
          payload = text;
        }

        if (typeof payload === "string") {
          try {
            payload = JSON.parse(payload);
          } catch {
            return;
          }
        }

        const pairs = extractAffiliationPairs(payload);
        if (pairs.length === 0) return;

        if (affiliateReady) {
          globalThis.postMessage(
            {
              type: "better-xitter:home-timeline-affiliations",
              pairs,
            },
            "*",
          );
          return;
        }

        const remaining = maxBufferedPairs - bufferedPairs.length;
        if (remaining <= 0) return;
        bufferedPairs = bufferedPairs.concat(pairs.slice(0, remaining));
      });
    }

    return originalOpen.apply(this, args);
  };

  globalThis.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as Record<string, unknown> | null;
    if (!data) return;
    if (data.type !== "better-xitter:affiliate-ready") return;
    if (affiliateReady) return;
    affiliateReady = true;
    if (bufferedPairs.length === 0) return;
    globalThis.postMessage(
      {
        type: "better-xitter:home-timeline-affiliations",
        pairs: bufferedPairs,
      },
      "*",
    );
    bufferedPairs = [];
  });

  function extractAffiliationPairs(payload: unknown): Pair[] {
    const instructions = get(payload, [
      "data",
      "home",
      "home_timeline_urt",
      "instructions",
    ]);
    if (!Array.isArray(instructions)) return [];

    const results: Pair[] = [];

    for (const instruction of instructions) {
      const entries = (instruction as Record<string, unknown> | null)?.entries;
      if (!Array.isArray(entries)) continue;

      for (const entry of entries) {
        const tweet =
          get(entry, ["content", "itemContent", "tweet_results", "result"]) ??
            get(entry, [
              "content",
              "items",
              0,
              "item",
              "itemContent",
              "tweet_results",
              "result",
            ]);
        if (!tweet) continue;

        collectPairsFromTweet(tweet, results);

        const quotedTweet = get(tweet, ["quoted_status_result", "result"]);
        if (quotedTweet) collectPairsFromTweet(quotedTweet, results);
      }
    }

    return results;
  }

  function collectPairsFromTweet(tweet: unknown, results: Pair[]): void {
    const author = get(tweet, [
      "core",
      "user_results",
      "result",
      "core",
      "screen_name",
    ]);
    if (typeof author !== "string" || author.length === 0) return;

    const affiliateUrl = get(tweet, [
      "core",
      "user_results",
      "result",
      "affiliates_highlighted_label",
      "label",
      "url",
      "url",
    ]);
    if (typeof affiliateUrl !== "string" || affiliateUrl.length === 0) {
      return;
    }

    const org = parseHandleFromProfileUrl(affiliateUrl);
    if (!org) return;

    results.push([author.toLowerCase(), org.toLowerCase()]);
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

  function parseHandleFromProfileUrl(url: string): string | null {
    try {
      const parsed = new URL(url);
      if (
        parsed.hostname !== "x.com" &&
        parsed.hostname !== "twitter.com" &&
        parsed.hostname !== "www.x.com" &&
        parsed.hostname !== "www.twitter.com"
      ) {
        return null;
      }
      let path = parsed.pathname;
      while (path.startsWith("/")) path = path.slice(1);
      const first = path.split("/")[0]?.trim();
      if (!first) return null;
      return first.startsWith("@") ? first.slice(1) : first;
    } catch {
      return null;
    }
  }
})();
