import { isInHomeTimeline, normalizeHandleList } from "@/utils.ts";

const affiliateHiddenAttribute = "data-better-xitter-affiliate-hidden";

let observer: MutationObserver | null = null;
let messageHooked = false;

let enabled = false;
let hideQuoteTweets = false;
let targetOrgHandles = new Set<string>();
const userAffiliationsByAuthorHandle = new Map<string, Set<string>>();
let scanScheduled = false;

export function configureAffiliateHide(
  nextEnabled: boolean,
  orgHandlesCsv: string,
  nextHideQuoteTweets: boolean,
): void {
  enabled = nextEnabled;
  hideQuoteTweets = nextHideQuoteTweets;
  targetOrgHandles = new Set(normalizeHandleList(orgHandlesCsv));

  if (!enabled || targetOrgHandles.size === 0) {
    teardownObserver();
    unhideAll();
    return;
  }

  ensureMessageHook();
  scan(document);
  ensureObserver();
}

function ensureMessageHook(): void {
  if (messageHooked) return;
  messageHooked = true;

  addEventListener("message", (event: MessageEvent) => {
    // Messages come from the page MAIN world hook via postMessage.
    // In Chrome, content scripts run in an isolated world, so `event.source === window`
    // is not a reliable filter here. We only key off `data.type`.
    const data = event.data as Record<string, unknown> | null;
    if (!data) return;
    if (data.type !== "better-xitter:home-timeline-affiliations") return;
    const pairs = data.pairs;
    if (!Array.isArray(pairs)) return;

    let changed = false;
    for (const pair of pairs) {
      if (!Array.isArray(pair) || pair.length !== 2) continue;
      const [author, org] = pair;
      if (typeof author !== "string" || typeof org !== "string") continue;
      if (author.length === 0 || org.length === 0) continue;

      let orgs = userAffiliationsByAuthorHandle.get(author);
      if (!orgs) {
        orgs = new Set<string>();
        userAffiliationsByAuthorHandle.set(author, orgs);
      }
      if (!orgs.has(org)) {
        orgs.add(org);
        changed = true;
      }
    }

    if (changed) scheduleScan();
  });

  // Ask the MAIN-world XHR hook to replay any affiliation pairs it already saw.
  // This avoids missing the initial HomeTimeline response if it completed before
  // this content script finished loading and installed its message listener.
  postMessage({ type: "better-xitter:affiliate-ready" }, "*");
}

function ensureObserver(): void {
  if (observer) return;

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList" || mutation.addedNodes.length === 0) {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        scan(node);
      }
    }
  });

  const root = document.body ?? document.documentElement;

  observer.observe(root, {
    childList: true,
    subtree: true,
  });
}

function teardownObserver(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

function scan(root: ParentNode): void {
  const tweets: HTMLElement[] = [];
  if (
    root instanceof HTMLElement && root.matches('article[data-testid="tweet"]')
  ) {
    tweets.push(root);
  }
  tweets.push(
    ...root.querySelectorAll<HTMLElement>('article[data-testid="tweet"]'),
  );

  for (const tweet of tweets) {
    if (tweet.parentElement?.closest('article[data-testid="tweet"]')) continue;
    applyVisibility(tweet);
  }
}

function applyVisibility(tweet: HTMLElement): void {
  if (!enabled || targetOrgHandles.size === 0 || !isInHomeTimeline(tweet)) {
    show(tweet);
    return;
  }

  if (!hasAffiliateMatch(tweet, hideQuoteTweets)) {
    show(tweet);
    return;
  }

  hide(tweet);
}

function hasAffiliateMatch(
  tweet: HTMLElement,
  includeQuoteTweets: boolean,
): boolean {
  let handles: string[];
  if (includeQuoteTweets) {
    handles = extractAllAuthorHandles(tweet);
  } else {
    const handle = extractAuthorHandle(tweet);
    handles = handle ? [handle] : [];
  }

  if (handles.length === 0) return false;

  for (const handle of handles) {
    const orgs = userAffiliationsByAuthorHandle.get(handle);
    if (!orgs || orgs.size === 0) continue;

    for (const org of orgs) {
      if (targetOrgHandles.has(org)) return true;
    }
  }
  return false;
}

function extractAuthorHandle(tweet: HTMLElement): string | null {
  const nameContainer = tweet.querySelector<HTMLElement>(
    'div[data-testid="User-Name"]',
  );
  if (!nameContainer) return null;
  return extractHandleFromUserNameContainer(nameContainer);
}

function extractAllAuthorHandles(tweet: HTMLElement): string[] {
  const containers = tweet.querySelectorAll<HTMLElement>(
    'div[data-testid="User-Name"]',
  );
  const handles = new Set<string>();

  for (const container of containers) {
    const handle = extractHandleFromUserNameContainer(container);
    if (!handle) continue;
    handles.add(handle);
  }

  return [...handles];
}

function extractHandleFromUserNameContainer(
  container: HTMLElement,
): string | null {
  const spans = container.querySelectorAll<HTMLSpanElement>("span");
  for (const span of spans) {
    const text = span.textContent?.trim() ?? "";
    if (!text.startsWith("@")) continue;
    const candidate = text.slice(1).trim();
    if (candidate) return candidate.toLowerCase();
  }
  return null;
}

function hide(tweet: HTMLElement): void {
  if (tweet.getAttribute(affiliateHiddenAttribute) === "true") return;
  tweet.setAttribute(affiliateHiddenAttribute, "true");
  tweet.style.display = "none";
}

function show(tweet: HTMLElement): void {
  if (tweet.getAttribute(affiliateHiddenAttribute) !== "true") return;
  tweet.removeAttribute(affiliateHiddenAttribute);
  tweet.style.display = "";
}

function unhideAll(): void {
  const hidden = document.querySelectorAll<HTMLElement>(
    `article[${affiliateHiddenAttribute}="true"]`,
  );
  for (const tweet of hidden) {
    show(tweet);
  }
}

function scheduleScan(): void {
  if (scanScheduled) return;
  scanScheduled = true;
  setTimeout(() => {
    scanScheduled = false;
    scan(document);
  }, 0);
}
