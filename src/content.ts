import {
  defaultSettings,
  getSettings,
  options,
  type Settings,
} from "@/options.ts";
import { configureQuickMuteBlock } from "@/quick-actions/quick_actions.ts";
import { configureAffiliateHide } from "@/hide-affiliates/hide_affiliates.ts";
import { configureAffiliatesMuteButtons } from "@/mute-affiliates/mute_affiliates.ts";
import { configureTweetInfo } from "@/tweet-info/tweet_info.ts";
const styleId = "better-xitter-style";
const liveOnXDataAttribute = "data-better-xitter-live-on-x-hidden";
let liveOnXObserver: MutationObserver | null = null;

function ensureStyleElement(): HTMLStyleElement {
  const existing = document.querySelector<HTMLStyleElement>(`#${styleId}`);
  if (existing) return existing;

  const style = document.createElement("style");
  style.id = styleId;
  const parent = document.head ?? document.documentElement;
  parent.append(style);
  return style;
}

function injectPageScript(path: string): void {
  const url = chrome.runtime.getURL(path);
  const script = document.createElement("script");
  script.src = url;
  const parent = document.head ?? document.documentElement;
  parent.append(script);
  script.remove();
}

function buildStyles(settings: Settings): string {
  const rules: string[] = [];

  for (const option of options) {
    if (!settings[option.id]) continue;
    const rule = option.selector
      ? `${option.selector} { ${option.rule} }`
      : option.rule;
    rules.push(rule);
  }

  return rules.join("\n");
}

function applySettings(settings: Settings): void {
  const style = ensureStyleElement();
  style.textContent = buildStyles(settings);
}

function hideLiveOnXInSidebar(sidebar: Element): void {
  const spans = sidebar.querySelectorAll("span");
  for (const span of spans) {
    if (span.textContent?.trim() !== "Live on X") continue;

    const level1 = span.parentElement as HTMLElement | null; // div>span
    if (!level1 || level1.tagName !== "DIV") continue;

    const level2 = level1.parentElement as HTMLElement | null; // h2>div
    if (!level2 || level2.tagName !== "H2") continue;

    const level3 = level2.parentElement as HTMLElement | null; // div>h2
    if (!level3 || level3.tagName !== "DIV") continue;

    const level4 = level3.parentElement as HTMLElement | null; // div>div
    if (!level4 || level4.tagName !== "DIV") continue;

    const topLevel = level4; // outermost div in the chain div>div>h2>div>span

    const targets: HTMLElement[] = [topLevel];
    const sibling = topLevel.nextElementSibling as HTMLElement | null;
    if (
      sibling &&
      sibling.tagName === "DIV" &&
      sibling.childElementCount === 0 &&
      sibling.textContent?.trim() === ""
    ) {
      targets.push(sibling);
    }

    for (const element of targets) {
      if (element.getAttribute(liveOnXDataAttribute) === "true") continue;
      element.setAttribute(liveOnXDataAttribute, "true");
      element.hidden = true;
    }
  }
}

function updateLiveOnXVisibility(enabled: boolean): void {
  if (!enabled) {
    if (liveOnXObserver) {
      liveOnXObserver.disconnect();
      liveOnXObserver = null;
    }
    const sidebar = document.querySelector('[data-testid="sidebarColumn"]');
    if (sidebar) {
      const elements = sidebar.querySelectorAll<HTMLElement>(
        `[${liveOnXDataAttribute}="true"]`,
      );
      for (const element of elements) {
        element.removeAttribute(liveOnXDataAttribute);
        element.hidden = false;
      }
    }
    return;
  }

  const apply = (): void => {
    const currentSidebar = document.querySelector(
      '[data-testid="sidebarColumn"]',
    );
    if (!currentSidebar) return;
    hideLiveOnXInSidebar(currentSidebar);
  };

  apply();

  if (liveOnXObserver) return;

  const root = document.body ?? document.documentElement;

  liveOnXObserver = new MutationObserver(() => {
    apply();
  });

  liveOnXObserver.observe(root, {
    childList: true,
    subtree: true,
  });
}

function watchSettingChanges(settings: Settings): void {
  let current = settings;

  function apply<T extends keyof Settings>(
    changes: Record<string, chrome.storage.StorageChange>,
    key: T,
    coerce: (raw: unknown) => Settings[T],
  ): boolean {
    const change = changes[key as string];
    if (!change) return false;
    current = {
      ...current,
      [key]: coerce(change.newValue ?? defaultSettings[key]),
    };
    return true;
  }

  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== "sync") return;

    let updated = false;

    for (const option of options) {
      if (apply(changes, option.id, Boolean)) {
        updated = true;
      }
    }

    for (
      const key of [
        "quickActionsMuteEnabled",
        "quickActionsBlockEnabled",
        "quickActionsNotInterestedEnabled",
        "quickActionsEnabled",
      ] as const
    ) {
      if (apply(changes, key, Boolean)) updated = true;
    }

    if (
      apply(
        changes,
        "quickActionsPosition",
        (v) => v as Settings["quickActionsPosition"],
      )
    ) updated = true;
    if (apply(changes, "hideAffiliatedOrgTweetsOrgs", String)) updated = true;

    if (changes.hideLiveOnX) {
      updateLiveOnXVisibility(current.hideLiveOnX);
    }

    if (
      changes.hideAffiliatedOrgTweets ||
      changes.hideAffiliatedOrgTweetsOrgs ||
      changes.hideAffiliatedOrgQuoteTweets
    ) {
      configureAffiliateHide(
        current.hideAffiliatedOrgTweets,
        current.hideAffiliatedOrgTweetsOrgs,
        current.hideAffiliatedOrgQuoteTweets,
      );
    }

    if (updated) {
      applySettings(current);
      configureQuickMuteBlock({
        enabled: current.quickActionsEnabled,
        position: current.quickActionsPosition,
        showMute: current.quickActionsMuteEnabled,
        showBlock: current.quickActionsBlockEnabled,
        showNotInterested: current.quickActionsNotInterestedEnabled,
      });
    }
  };

  chrome.storage.onChanged.addListener(listener);
}

async function main(): Promise<void> {
  const settings = await getSettings();
  applySettings(settings);
  configureAffiliatesMuteButtons(true);
  configureQuickMuteBlock({
    enabled: settings.quickActionsEnabled,
    position: settings.quickActionsPosition,
    showMute: settings.quickActionsMuteEnabled,
    showBlock: settings.quickActionsBlockEnabled,
    showNotInterested: settings.quickActionsNotInterestedEnabled,
  });
  updateLiveOnXVisibility(settings.hideLiveOnX);

  injectPageScript("hide-affiliates/home_timeline_xhr_hook.js");
  injectPageScript("mute-affiliates/affiliates_page_xhr_hook.js");

  if (settings.showTweetClientInfo || settings.showTweetLocationInfo) {
    injectPageScript("tweet-info/tweet_info_page.js");
    configureTweetInfo({
      showClientInfo: settings.showTweetClientInfo,
      showLocationInfo: settings.showTweetLocationInfo,
    });
  }

  configureAffiliateHide(
    settings.hideAffiliatedOrgTweets,
    settings.hideAffiliatedOrgTweetsOrgs,
    settings.hideAffiliatedOrgQuoteTweets,
  );
  watchSettingChanges(settings);
}

main();
