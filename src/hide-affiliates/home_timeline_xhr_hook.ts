import { getPath } from "@/utils.ts";

// Runs in the page's main world, because content scripts live in an isolated
// world and cannot patch the page's own XMLHttpRequest.
((): void => {
  const INSTALLED_FLAG = "__betterXitterHomeTimelineXhrHookInstalled";
  const MAX_SEEN_PAIRS = 5000;

  const page = globalThis as unknown as Record<string, unknown>;
  if (page[INSTALLED_FLAG]) return;
  page[INSTALLED_FLAG] = true;

  type AffiliationPair = [author: string, org: string];

  // Pairs are posted as soon as they are seen. The content script may not be
  // listening yet, so they are also kept and replayed on "affiliate-ready".
  const seenPairs: AffiliationPair[] = [];

  const originalOpen = XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open = function open(
    this: XMLHttpRequest,
    ...args: [method: string, url: string | URL, ...rest: unknown[]]
  ): void {
    const pathname = URL.parse(args[1], location.origin)?.pathname ?? "";
    if (pathname.includes("/graphql/") && pathname.endsWith("/HomeTimeline")) {
      this.addEventListener("load", () => handleHomeTimeline(this));
    }

    Reflect.apply(originalOpen, this, args);
  };

  addEventListener("message", (event: MessageEvent) => {
    if (event.data?.type !== "better-xitter:affiliate-ready") return;
    if (seenPairs.length > 0) postPairs(seenPairs);
  });

  function handleHomeTimeline(xhr: XMLHttpRequest): void {
    const pairs = extractAffiliationPairs(readJson(xhr));
    if (pairs.length === 0) return;

    postPairs(pairs);

    const room = MAX_SEEN_PAIRS - seenPairs.length;
    seenPairs.push(...pairs.slice(0, Math.max(room, 0)));
  }

  function postPairs(pairs: AffiliationPair[]): void {
    postMessage(
      { type: "better-xitter:home-timeline-affiliations", pairs },
      "*",
    );
  }

  function readJson(xhr: XMLHttpRequest): unknown {
    if (xhr.responseType === "json") return xhr.response;

    try {
      return JSON.parse(xhr.responseText);
    } catch {
      return null;
    }
  }

  function extractAffiliationPairs(payload: unknown): AffiliationPair[] {
    const instructions = getPath(payload, [
      "data",
      "home",
      "home_timeline_urt",
      "instructions",
    ]);
    if (!Array.isArray(instructions)) return [];

    const pairs: AffiliationPair[] = [];

    for (const instruction of instructions) {
      const entries = getPath(instruction, ["entries"]);
      if (!Array.isArray(entries)) continue;

      for (const entry of entries) {
        const tweet = getPath(entry, [
          "content",
          "itemContent",
          "tweet_results",
          "result",
        ]) ?? getPath(entry, [
          "content",
          "items",
          0,
          "item",
          "itemContent",
          "tweet_results",
          "result",
        ]);
        if (!tweet) continue;

        const quotedTweet = getPath(tweet, ["quoted_status_result", "result"]);

        for (const candidate of [tweet, quotedTweet]) {
          const pair = extractAffiliationPair(candidate);
          if (pair) pairs.push(pair);
        }
      }
    }

    return pairs;
  }

  function extractAffiliationPair(tweet: unknown): AffiliationPair | null {
    const user = getPath(tweet, ["core", "user_results", "result"]);
    const author = getPath(user, ["core", "screen_name"]);
    const affiliateUrl = getPath(user, [
      "affiliates_highlighted_label",
      "label",
      "url",
      "url",
    ]);
    if (typeof author !== "string" || !author) return null;
    if (typeof affiliateUrl !== "string") return null;

    const url = URL.parse(affiliateUrl);
    if (!url || !/^(?:www\.)?(?:x|twitter)\.com$/u.test(url.hostname)) {
      return null;
    }

    const org = url.pathname.split("/").find(Boolean)?.trim().replace(
      /^@/u,
      "",
    );
    if (!org) return null;

    return [author.toLowerCase(), org.toLowerCase()];
  }
})();
