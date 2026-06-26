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
  const path = location.pathname;

  if (!path.includes(`/status/${tweetId}`)) {
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

  if (showLocationInfo && accountBasedIn?.trim()) {
    applyTweetLocationToPermalinkBar(
      bar,
      accountBasedIn,
      locationAccurate === true,
    );
  }
}

type TweetInfoMessage = {
  tweetId: string;
  sourceName: string | null;
  accountBasedIn: string | null;
  locationAccurate: boolean | null;
};

function parseTweetInfoMessage(
  value: unknown,
  showClientInfo: boolean,
): TweetInfoMessage | null {
  if (typeof value !== "object" || value === null) return null;

  const data = value as Record<string, unknown>;
  if (data.type !== "better-xitter:tweet-info") return null;
  if (typeof data.tweetId !== "string") return null;
  if (showClientInfo && typeof data.sourceName !== "string") return null;

  return {
    tweetId: data.tweetId,
    sourceName: typeof data.sourceName === "string" ? data.sourceName : null,
    accountBasedIn: typeof data.accountBasedIn === "string"
      ? data.accountBasedIn
      : null,
    locationAccurate: typeof data.locationAccurate === "boolean"
      ? data.locationAccurate
      : null,
  };
}

export function configureTweetInfo(input: {
  showClientInfo: boolean;
  showLocationInfo: boolean;
}): void {
  const { showClientInfo, showLocationInfo } = input;
  addEventListener("message", (event: MessageEvent) => {
    const data = parseTweetInfoMessage(event.data, showClientInfo);
    if (!data) return;

    decorateTweetById(
      data.tweetId,
      showClientInfo ? data.sourceName : null,
      data.accountBasedIn,
      data.locationAccurate,
      showClientInfo,
      showLocationInfo,
    );
  });
}
