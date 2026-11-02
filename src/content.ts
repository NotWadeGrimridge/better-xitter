import { configureAffiliateHide } from "@/hide-affiliates/hide_affiliates.ts";
import { configureAffiliatesMuteButtons } from "@/mute-affiliates/mute_affiliates.ts";
import { getSettings, mergeSettings, OPTIONS } from "@/options.ts";
import type { RawSettings, Settings } from "@/options.ts";
import { configureQuickMuteBlock } from "@/quick-actions/quick_actions.ts";
import { configureTweetInfo } from "@/tweet-info/tweet_info.ts";

const STYLE_ID = "better-xitter-style";
const LIVE_ON_X_HIDDEN_ATTRIBUTE = "data-better-xitter-live-on-x-hidden";
const SIDEBAR_SELECTOR = '[data-testid="sidebarColumn"]';

let liveOnXObserver: MutationObserver | null = null;

function injectPageScript(path: string): void {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL(path);
  (document.head ?? document.documentElement).append(script);
  script.remove();
}

function applyStyles(settings: Settings): void {
  let style = document.querySelector<HTMLStyleElement>(`#${STYLE_ID}`);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    (document.head ?? document.documentElement).append(style);
  }

  style.textContent = OPTIONS
    .filter((option) => settings[option.id] && option.rule)
    .map((option) =>
      option.selector ? `${option.selector} { ${option.rule} }` : option.rule
    )
    .join("\n");
}

function hideLiveOnX(): void {
  const spans = document.querySelectorAll(
    `${SIDEBAR_SELECTOR} div > div > h2 > div > span`,
  );

  for (const span of spans) {
    if (span.textContent?.trim() !== "Live on X") continue;

    const section = span.closest("h2")?.parentElement?.parentElement;
    if (!section) continue;

    const targets = [section];
    const spacer = section.nextElementSibling;
    if (
      spacer instanceof HTMLDivElement &&
      spacer.childElementCount === 0 &&
      spacer.textContent?.trim() === ""
    ) {
      targets.push(spacer);
    }

    for (const target of targets) {
      target.setAttribute(LIVE_ON_X_HIDDEN_ATTRIBUTE, "true");
      target.hidden = true;
    }
  }
}

function configureLiveOnX(enabled: boolean): void {
  if (enabled) {
    hideLiveOnX();
    if (!liveOnXObserver) {
      liveOnXObserver = new MutationObserver(hideLiveOnX);
      liveOnXObserver.observe(document.body ?? document.documentElement, {
        childList: true,
        subtree: true,
      });
    }
    return;
  }

  liveOnXObserver?.disconnect();
  liveOnXObserver = null;

  const hidden = document.querySelectorAll<HTMLElement>(
    `${SIDEBAR_SELECTOR} [${LIVE_ON_X_HIDDEN_ATTRIBUTE}]`,
  );
  for (const element of hidden) {
    element.removeAttribute(LIVE_ON_X_HIDDEN_ATTRIBUTE);
    element.hidden = false;
  }
}

function applySettings(settings: Settings): void {
  applyStyles(settings);
  configureLiveOnX(settings.hideLiveOnX);
  configureAffiliateHide(
    settings.hideAffiliatedOrgTweets,
    settings.hideAffiliatedOrgTweetsOrgs,
    settings.hideAffiliatedOrgQuoteTweets,
  );
  configureQuickMuteBlock({
    enabled: settings.quickActionsEnabled,
    position: settings.quickActionsPosition,
    showMute: settings.quickActionsMuteEnabled,
    showBlock: settings.quickActionsBlockEnabled,
    showNotInterested: settings.quickActionsNotInterestedEnabled,
  });
}

async function main(): Promise<void> {
  let settings = await getSettings();

  injectPageScript("hide-affiliates/home_timeline_xhr_hook.js");
  injectPageScript("mute-affiliates/affiliates_page_xhr_hook.js");

  if (settings.showTweetClientInfo || settings.showTweetLocationInfo) {
    injectPageScript("tweet-info/tweet_info_page.js");
    configureTweetInfo({
      showClientInfo: settings.showTweetClientInfo,
      showLocationInfo: settings.showTweetLocationInfo,
    });
  }

  configureAffiliatesMuteButtons();
  applySettings(settings);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") return;

    const update: RawSettings = Object.fromEntries(
      Object.entries(changes).map(([key, change]) => [key, change.newValue]),
    );
    settings = mergeSettings(settings, update);
    applySettings(settings);
  });
}

// oxlint-disable-next-line unicorn/prefer-top-level-await -- Content scripts are classic scripts, so top-level await is not available.
main();
