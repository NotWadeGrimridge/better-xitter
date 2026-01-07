/// <reference lib="dom" />

import {
  defaultSettings,
  getSettings,
  type Option,
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
  const existing = document.getElementById(styleId);
  if (existing) return existing as HTMLStyleElement;

  const style = document.createElement("style");
  style.id = styleId;
  const parent = document.head ?? document.documentElement;
  if (!parent) throw new Error("Missing document root");
  parent.append(style);
  return style;
}

function buildStyles(settings: Settings): string {
  const rules: string[] = [];

  for (const option of options as readonly Option[]) {
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
  if (!root) return;

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

  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== "sync") return;

    let updated = false;
    for (const option of options) {
      const change = changes[option.id];
      if (!change) continue;

      current = {
        ...current,
        [option.id]: Boolean(
          change.newValue ?? defaultSettings[option.id],
        ),
      };
      updated = true;
    }

    const quickActionsEnabledChange = changes.quickActionsEnabled;
    if (quickActionsEnabledChange) {
      current = {
        ...current,
        quickActionsEnabled: Boolean(
          quickActionsEnabledChange.newValue ??
            defaultSettings.quickActionsEnabled,
        ),
      };
      updated = true;
    }

    const quickActionsPositionChange = changes.quickActionsPosition;
    if (quickActionsPositionChange) {
      current = {
        ...current,
        quickActionsPosition: (quickActionsPositionChange.newValue ??
          defaultSettings.quickActionsPosition) as Settings[
            "quickActionsPosition"
          ],
      };
      updated = true;
    }

    const hideLiveOnXChange = changes.hideLiveOnX;
    if (hideLiveOnXChange) {
      current = {
        ...current,
        hideLiveOnX: Boolean(
          hideLiveOnXChange.newValue ?? defaultSettings.hideLiveOnX,
        ),
      };
      updated = true;
      updateLiveOnXVisibility(Boolean(current.hideLiveOnX));
    }

    const hideAffiliateChange = changes.hideAffiliatedOrgTweets;
    if (hideAffiliateChange) {
      current = {
        ...current,
        hideAffiliatedOrgTweets: Boolean(
          hideAffiliateChange.newValue ??
            defaultSettings.hideAffiliatedOrgTweets,
        ),
      };
      updated = true;
      configureAffiliateHide(
        Boolean(current.hideAffiliatedOrgTweets),
        current.hideAffiliatedOrgTweetsOrgs,
        Boolean(current.hideAffiliatedOrgQuoteTweets),
      );
    }

    const hideAffiliateOrgsChange = changes.hideAffiliatedOrgTweetsOrgs;
    if (hideAffiliateOrgsChange) {
      current = {
        ...current,
        hideAffiliatedOrgTweetsOrgs: String(
          hideAffiliateOrgsChange.newValue ??
            defaultSettings.hideAffiliatedOrgTweetsOrgs,
        ),
      };
      updated = true;
      configureAffiliateHide(
        Boolean(current.hideAffiliatedOrgTweets),
        current.hideAffiliatedOrgTweetsOrgs,
        Boolean(current.hideAffiliatedOrgQuoteTweets),
      );
    }

    const hideAffiliateQuoteTweetsChange = changes.hideAffiliatedOrgQuoteTweets;
    if (hideAffiliateQuoteTweetsChange) {
      current = {
        ...current,
        hideAffiliatedOrgQuoteTweets: Boolean(
          hideAffiliateQuoteTweetsChange.newValue ??
            defaultSettings.hideAffiliatedOrgQuoteTweets,
        ),
      };
      updated = true;
      configureAffiliateHide(
        Boolean(current.hideAffiliatedOrgTweets),
        current.hideAffiliatedOrgTweetsOrgs,
        Boolean(current.hideAffiliatedOrgQuoteTweets),
      );
    }

    if (updated) {
      applySettings(current);
      configureQuickMuteBlock({
        enabled: current.quickActionsEnabled,
        position: current.quickActionsPosition,
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
  });
  updateLiveOnXVisibility(Boolean(settings.hideLiveOnX));

  {
    const url = chrome.runtime.getURL(
      "hide-affiliates/home_timeline_xhr_hook.js",
    );
    const script = document.createElement("script");
    script.src = url;
    script.type = "text/javascript";
    const parent = document.head ?? document.documentElement;
    if (parent) parent.append(script);
    script.remove();
  }

  {
    const url = chrome.runtime.getURL(
      "mute-affiliates/affiliates_page_xhr_hook.js",
    );
    const script = document.createElement("script");
    script.src = url;
    script.type = "text/javascript";
    const parent = document.head ?? document.documentElement;
    if (parent) parent.append(script);
    script.remove();
  }

  if (settings.showTweetClientInfo || settings.showTweetLocationInfo) {
    const url = chrome.runtime.getURL(
      "tweet-info/tweet_info_page.js",
    );
    const script = document.createElement("script");
    script.src = url;
    script.type = "text/javascript";
    const parent = document.head ?? document.documentElement;
    if (parent) parent.append(script);
    script.remove();
    configureTweetInfo({
      showClientInfo: Boolean(settings.showTweetClientInfo),
      showLocationInfo: Boolean(settings.showTweetLocationInfo),
    });
  }
  configureAffiliateHide(
    Boolean(settings.hideAffiliatedOrgTweets),
    settings.hideAffiliatedOrgTweetsOrgs,
    Boolean(settings.hideAffiliatedOrgQuoteTweets),
  );
  watchSettingChanges(settings);
}

main();
