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

function decorateTweetById(tweetId: string, sourceName: string): void {
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
    console.debug("[better-xitter] tweet_client_info: no time element");
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
    console.debug("[better-xitter] tweet_client_info: no permalink bar");
    return;
  }

  applyTweetSourceToPermalinkBar(bar, sourceName);
}

export function configureTweetClientInfo(): void {
  const win = globalThis as unknown as Window;

  win.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as
      | { type?: unknown; tweetId?: unknown; sourceName?: unknown }
      | null;
    if (!data) return;
    if (data.type !== "better-xitter:tweet-client-info") return;
    if (typeof data.tweetId !== "string") return;
    if (typeof data.sourceName !== "string") return;
    decorateTweetById(data.tweetId, data.sourceName);
  });
}
