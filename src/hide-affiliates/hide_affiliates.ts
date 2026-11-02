import { isInHomeTimeline, normalizeHandleList } from "@/utils.ts";

const HIDDEN_ATTRIBUTE = "data-better-xitter-affiliate-hidden";
const TWEET_SELECTOR = 'article[data-testid="tweet"]';

const affiliationsByAuthor = new Map<string, Set<string>>();

let enabled = false;
let hideQuoteTweets = false;
let targetOrgs = new Set<string>();
let observer: MutationObserver | null = null;
let messageListenerInstalled = false;
let scanScheduled = false;

export function configureAffiliateHide(
  nextEnabled: boolean,
  orgHandles: string,
  nextHideQuoteTweets: boolean,
): void {
  enabled = nextEnabled;
  hideQuoteTweets = nextHideQuoteTweets;
  targetOrgs = new Set(normalizeHandleList(orgHandles));

  if (!enabled || targetOrgs.size === 0) {
    observer?.disconnect();
    observer = null;
    for (
      const tweet of document.querySelectorAll<HTMLElement>(
        `[${HIDDEN_ATTRIBUTE}]`,
      )
    ) {
      setHidden(tweet, false);
    }
    return;
  }

  installMessageListener();
  scan(document);

  if (!observer) {
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) scan(node);
        }
      }
    });
    observer.observe(document.body ?? document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
}

function installMessageListener(): void {
  if (messageListenerInstalled) return;
  messageListenerInstalled = true;

  // Content scripts run in an isolated world, so `event.source === window`
  // cannot identify messages from the page hook. Filter on `data.type` instead.
  addEventListener("message", (event: MessageEvent) => {
    if (event.data?.type !== "better-xitter:home-timeline-affiliations") return;

    let changed = false;
    for (const [author, org] of parseAffiliationPairs(event.data.pairs)) {
      const orgs = affiliationsByAuthor.get(author) ?? new Set();
      affiliationsByAuthor.set(author, orgs);

      if (orgs.has(org)) continue;
      orgs.add(org);
      changed = true;
    }

    if (changed) scheduleScan();
  });

  // The page hook buffers pairs it sees before this listener exists,
  // and replays them once it gets this signal.
  postMessage({ type: "better-xitter:affiliate-ready" }, "*");
}

function parseAffiliationPairs(value: unknown): [string, string][] {
  if (!Array.isArray(value)) return [];

  return value.filter((pair): pair is [string, string] =>
    Array.isArray(pair) &&
    pair.length === 2 &&
    pair.every((handle) => typeof handle === "string" && handle.length > 0)
  );
}

function scheduleScan(): void {
  if (scanScheduled) return;
  scanScheduled = true;

  setTimeout(() => {
    scanScheduled = false;
    scan(document);
  }, 0);
}

function scan(root: Document | Element): void {
  const tweets = [...root.querySelectorAll<HTMLElement>(TWEET_SELECTOR)];
  if (root instanceof HTMLElement && root.matches(TWEET_SELECTOR)) {
    tweets.unshift(root);
  }

  for (const tweet of tweets) {
    if (tweet.parentElement?.closest(TWEET_SELECTOR)) continue;

    setHidden(
      tweet,
      enabled && targetOrgs.size > 0 && isInHomeTimeline(tweet) &&
        hasAffiliateMatch(tweet),
    );
  }
}

function hasAffiliateMatch(tweet: HTMLElement): boolean {
  const nameContainers = [
    ...tweet.querySelectorAll('div[data-testid="User-Name"]'),
  ];
  const authorContainers = hideQuoteTweets
    ? nameContainers
    : nameContainers.slice(0, 1);

  return authorContainers.some((container) => {
    const handle = extractHandle(container);
    const orgs = handle ? affiliationsByAuthor.get(handle) : null;
    return orgs ? !orgs.isDisjointFrom(targetOrgs) : false;
  });
}

function extractHandle(nameContainer: Element): string | null {
  for (const span of nameContainer.querySelectorAll("span")) {
    const handle = span.textContent?.trim() ?? "";
    if (handle.startsWith("@") && handle.length > 1) {
      return handle.slice(1).trim().toLowerCase();
    }
  }
  return null;
}

function setHidden(tweet: HTMLElement, hidden: boolean): void {
  if (tweet.hasAttribute(HIDDEN_ATTRIBUTE) === hidden) return;

  tweet.toggleAttribute(HIDDEN_ATTRIBUTE, hidden);
  tweet.style.display = hidden ? "none" : "";
}
