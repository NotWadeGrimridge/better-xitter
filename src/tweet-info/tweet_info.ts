const SOURCE_NAME_FILLER_WORDS = new Set(["twitter", "for", "app"]);

type TweetInfoConfig = {
  showClientInfo: boolean;
  showLocationInfo: boolean;
};

export function configureTweetInfo(
  { showClientInfo, showLocationInfo }: TweetInfoConfig,
): void {
  addEventListener("message", (event: MessageEvent) => {
    const { data } = event;
    if (data?.type !== "better-xitter:tweet-info") return;

    const { tweetId, sourceName, accountBasedIn, locationAccurate } = data;
    if (typeof tweetId !== "string") return;
    if (!location.pathname.includes(`/status/${tweetId}`)) return;

    const bar = document
      .querySelector(`a[href*="/status/${tweetId}"]`)
      ?.closest('article[data-testid="tweet"]')
      ?.querySelector("a time")
      ?.parentElement
      ?.parentElement;
    if (!bar) return;

    if (showClientInfo && typeof sourceName === "string") {
      const cleanedSourceName = sourceName
        .split(/\s+/u)
        .filter((word) => !SOURCE_NAME_FILLER_WORDS.has(word.toLowerCase()))
        .join(" ")
        .trim();
      appendToPermalinkBar(bar, "source", cleanedSourceName);
    }

    if (
      showLocationInfo && typeof accountBasedIn === "string" &&
      accountBasedIn.trim()
    ) {
      appendToPermalinkBar(
        bar,
        "location",
        locationAccurate === true ? accountBasedIn : `${accountBasedIn}?`,
      );
    }
  });
}

function appendToPermalinkBar(
  bar: Element,
  kind: "source" | "location",
  text: string,
): void {
  const className = `better-xitter-tweet-${kind}`;
  const marker = `data-${className}`;
  if (bar.hasAttribute(marker)) return;

  const separator = document.createElement("span");
  separator.className = `${className}-separator`;
  separator.ariaHidden = "true";
  separator.textContent = "·";
  separator.style.cssText = "padding: 0 4px; color: inherit";

  const label = document.createElement("span");
  label.className = className;
  label.textContent = text;
  label.style.color = "inherit";

  bar.append(separator, label);
  bar.setAttribute(marker, "true");
}
