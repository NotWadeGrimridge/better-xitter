/// <reference lib="dom" />

import { isInHomeTimeline, normalizeHandleList } from "../utils.ts";

const affiliateHiddenAttribute = "data-better-xitter-affiliate-hidden";

let observer: MutationObserver | null = null;
let messageHooked = false;

let enabled = false;
let targetOrgHandles = new Set<string>();
const userAffiliationsByAuthorHandle = new Map<string, Set<string>>();
let scanScheduled = false;

export function configureAffiliateHide(
  nextEnabled: boolean,
  orgHandlesCsv: string,
): void {
  enabled = nextEnabled;
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

  const selfWindow = globalThis as unknown as Window;

  selfWindow.addEventListener("message", (event: MessageEvent) => {
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
  selfWindow.postMessage({ type: "better-xitter:affiliate-ready" }, "*");
}

function ensureObserver(): void {
  if (observer) return;

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList" || mutation.addedNodes.length === 0) {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        scan(node as Element);
      }
    }
  });

  const root = document.body ?? document.documentElement;
  if (!root) return;

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

  if (!hasAffiliateMatch(tweet)) {
    show(tweet);
    return;
  }

  hide(tweet);
}

function hasAffiliateMatch(tweet: HTMLElement): boolean {
  const authorHandle = extractAuthorHandle(tweet);
  if (!authorHandle) return false;

  const orgs = userAffiliationsByAuthorHandle.get(authorHandle);
  if (!orgs || orgs.size === 0) return false;

  for (const org of orgs) {
    if (targetOrgHandles.has(org)) return true;
  }
  return false;
}

function extractAuthorHandle(tweet: HTMLElement): string | null {
  const nameContainer = tweet.querySelector<HTMLElement>(
    'div[data-testid="User-Name"]',
  );
  if (!nameContainer) return null;

  const link = nameContainer.querySelector<HTMLAnchorElement>(
    'a[href^="/"][role="link"]',
  );
  const href = link?.getAttribute("href") ?? "";
  if (!href.startsWith("/")) return null;

  let path = href;
  for (; path.startsWith("/"); path = path.slice(1));
  const handle = path.split("/")[0]?.trim();
  if (!handle) return null;
  return handle.toLowerCase();
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
