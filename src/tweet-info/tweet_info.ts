/// <reference lib="dom" />

function applyTweetSourceToPermalinkBar(
  bar: HTMLElement,
  sourceName: string,
): void {
  if (bar.getAttribute("data-better-xitter-tweet-source") === "true") {
    return;
  }

  const separator = document.createElement("span");
  separator.textContent = "·";
  separator.className = "better-xitter-tweet-source-separator";
  separator.setAttribute("aria-hidden", "true");
  separator.style.padding = "0 4px";
  separator.style.color = "inherit";

  const cleanedSourceName = sourceName
    .split(/\s+/)
    .filter((part) => {
      const lower = part.toLowerCase();
      return lower !== "twitter" && lower !== "for" && lower !== "app";
    })
    .join(" ")
    .trim();

  const label = document.createElement("span");
  label.textContent = cleanedSourceName;
  label.className = "better-xitter-tweet-source";
  label.style.color = "inherit";

  bar.append(separator, label);
  bar.setAttribute("data-better-xitter-tweet-source", "true");
}

function applyTweetLocationToPermalinkBar(
  bar: HTMLElement,
  accountBasedIn: string,
  locationAccurate: boolean,
): void {
  if (bar.getAttribute("data-better-xitter-tweet-location") === "true") {
    return;
  }

  const separator = document.createElement("span");
  separator.textContent = "·";
  separator.className = "better-xitter-tweet-location-separator";
  separator.setAttribute("aria-hidden", "true");
  separator.style.padding = "0 4px";
  separator.style.color = "inherit";

  const label = document.createElement("span");
  label.textContent = locationAccurate ? accountBasedIn : `${accountBasedIn}?`;
  label.className = "better-xitter-tweet-location";
  label.style.color = "inherit";

  bar.append(separator, label);
  bar.setAttribute("data-better-xitter-tweet-location", "true");
}

function decorateTweetById(
  tweetId: string,
  sourceName: string | null,
  accountBasedIn: string | null,
  locationAccurate: boolean | null,
  showClientInfo: boolean,
  showLocationInfo: boolean,
): void {
  const win = globalThis as unknown as Window;
  const path = win.location?.pathname ?? "";

  if (!new RegExp(`^/[^/]+/status/${tweetId}(?:/|$)`).test(path)) {
    return;
  }

  const link = document.querySelector<HTMLAnchorElement>(
    `a[href*="/status/${tweetId}"]`,
  );
  if (!link) {
    return;
  }

  const tweet = link.closest<HTMLElement>('article[data-testid="tweet"]');
  if (!tweet) {
    return;
  }

  const time = tweet.querySelector("a time");
  if (!time) {
    console.debug("[better-xitter] tweet_info: no time element");
    return;
  }

  let bar = time.parentElement as HTMLElement | null;
  if (!bar) return;

  while (bar.parentElement && bar.parentElement !== tweet) {
    const parent = bar.parentElement as HTMLElement;
    if (parent.querySelector("time") === time) {
      bar = parent;
      break;
    }
    bar = parent;
  }

  if (!bar || bar === tweet) {
    console.debug("[better-xitter] tweet_info: no permalink bar");
    return;
  }

  if (showClientInfo && typeof sourceName === "string") {
    applyTweetSourceToPermalinkBar(bar, sourceName);
  }

  if (
    showLocationInfo && accountBasedIn && accountBasedIn.trim().length > 0
  ) {
    applyTweetLocationToPermalinkBar(
      bar,
      accountBasedIn,
      locationAccurate === true,
    );
  }
}

export function configureTweetInfo(input: {
  showClientInfo: boolean;
  showLocationInfo: boolean;
}): void {
  const win = globalThis as unknown as Window;
  const showClientInfo = Boolean(input.showClientInfo);
  const showLocationInfo = Boolean(input.showLocationInfo);

  win.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as
      | {
        type?: unknown;
        tweetId?: unknown;
        sourceName?: unknown;
        accountBasedIn?: unknown;
        locationAccurate?: unknown;
      }
      | null;
    if (!data) return;
    if (data.type !== "better-xitter:tweet-info") return;
    if (typeof data.tweetId !== "string") return;
    if (showClientInfo && typeof data.sourceName !== "string") return;
    const accountBasedIn = typeof data.accountBasedIn === "string"
      ? data.accountBasedIn
      : null;
    const locationAccurate = typeof data.locationAccurate === "boolean"
      ? data.locationAccurate
      : null;
    decorateTweetById(
      data.tweetId,
      showClientInfo ? data.sourceName as string : null,
      accountBasedIn,
      locationAccurate,
      showClientInfo,
      showLocationInfo,
    );
  });
}
