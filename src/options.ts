export type OptionId =
  | "hideOffers"
  | "hideTrending"
  | "hideLiveOnX"
  | "hideNews"
  | "hideWhoToFollow"
  | "hideFooter"
  | "showTweetClientInfo"
  | "showTweetLocationInfo"
  | "hideAffiliatedOrgTweets"
  | "hideAffiliatedOrgQuoteTweets"
  | "hideNewPostsBanner"
  | "hideTimelineSideBorders"
  | "hidePromotedPosts"
  | "hideGrokButton"
  | "hideGrokDrawer"
  | "hideChatDrawer"
  | "hideNavigationLabels"
  | "centerNavigation"
  | "movePostButtonToCorner";

export type Option = {
  id: OptionId;
  label: string;
  rule?: string;
  selector?: string;
  defaultEnabled: boolean;
  children?: readonly Option[];
};

export const OPTION_HIERARCHY = [
  {
    id: "hideOffers",
    label: "Hide Premium nagging",
    selector: `
      [data-testid="sidebarColumn"]
      :is(
        div:has(> div > aside[role="complementary"] a[href^="/i/premium_sign_up"]),
        div:has(> div > aside[role="complementary"] a[href^="/i/premium_sign_up"]) + div:empty
      ),
      [data-testid="sidebarColumn"]
      div:has(> div > div[data-testid="super-upsell-UpsellCardRenderProperties"])
    `,
    rule: "display: none !important",
    defaultEnabled: true,
  },
  {
    id: "hideTrending",
    label: 'Hide "What\'s Happening"',
    selector: `
      [data-testid="sidebarColumn"]
      div:has(> section > div[aria-label="Timeline: Trending now"])
    `,
    rule: "display: none !important",
    defaultEnabled: true,
  },
  {
    id: "hideLiveOnX",
    label: 'Hide "Live on X"',
    defaultEnabled: true,
  },
  {
    id: "hideNews",
    label: 'Hide "Today\'s News"',
    selector: `
      [data-testid="sidebarColumn"]
      div:has(> [data-testid="news_sidebar"])
    `,
    rule: "display: none !important",
    defaultEnabled: true,
  },
  {
    id: "hideWhoToFollow",
    label: 'Hide "Who to follow"',
    selector: `
      [data-testid="sidebarColumn"]
      div:has(> div > :is(div, aside)[aria-label="Who to follow"])
    `,
    rule: "display: none !important",
    defaultEnabled: true,
  },
  {
    id: "hideFooter",
    label: "Hide footer",
    selector: '[data-testid="sidebarColumn"] [aria-label="Footer"]',
    rule: "display: none !important",
    defaultEnabled: true,
  },
  {
    id: "showTweetClientInfo",
    label: "Show client on tweets",
    defaultEnabled: true,
  },
  {
    id: "showTweetLocationInfo",
    label: "Show country on tweets",
    defaultEnabled: true,
  },
  {
    id: "hideAffiliatedOrgTweets",
    label: "Hide affiliates of chosen orgs",
    defaultEnabled: false,
    children: [
      {
        id: "hideAffiliatedOrgQuoteTweets",
        label: "Also hide quote-tweets of affiliates",
        defaultEnabled: false,
      },
    ],
  },
  {
    id: "hideNewPostsBanner",
    label: "Hide New Posts button",
    selector:
      'button[aria-label="New posts are available. Push the period key to go to the them."]',
    rule: "display: none !important",
    defaultEnabled: true,
  },
  {
    id: "hideTimelineSideBorders",
    label: "Hide side borders on timeline",
    selector: '[data-testid="primaryColumn"]',
    rule: "border-left-width: 0 !important; border-right-width: 0 !important;",
    defaultEnabled: true,
  },
  {
    id: "hidePromotedPosts",
    label: "Hide promoted posts",
    // Target the article only, so other cards in placementTracking (such as videos) stay visible.
    selector: `
      [data-testid="placementTracking"] article,
      a[href*="quick_promote_web"]
    `,
    rule: "display: none !important",
    defaultEnabled: true,
  },
  {
    id: "hideGrokButton",
    label: "Hide Grok button in posts",
    selector: `
      article[data-testid="tweet"]
      div:has(> button[aria-label="Grok actions"])
    `,
    rule: "display: none !important",
    defaultEnabled: true,
  },
  {
    id: "hideGrokDrawer",
    label: "Hide Grok drawer",
    selector: '[data-testid="GrokDrawer"]',
    rule: "display: none !important",
    defaultEnabled: true,
  },
  {
    id: "hideChatDrawer",
    label: "Hide Chat drawer",
    selector: '[data-testid="chat-drawer-root"]',
    rule: "display: none !important",
    defaultEnabled: true,
  },
  {
    id: "hideNavigationLabels",
    label: "Hide labels in left sidebar",
    rule: `
      header[role="banner"] nav[role="navigation"] > * > div > :not(:first-child) {
        display: none !important;
      }
      [data-testid="SideNav_AccountSwitcher_Button"] > :not(:first-child) {
        display: none !important;
      }
    `,
    defaultEnabled: true,
  },
  {
    id: "centerNavigation",
    label: "Vertically center left sidebar",
    rule: `
      @media (min-width: 1000px) {
        header[role="banner"] > div > div > div {
          justify-content: center;
          padding-top: 0;
        }
      }
    `,
    defaultEnabled: true,
  },
  {
    id: "movePostButtonToCorner",
    label: "Move Post button to bottom-right corner",
    rule: `
      @media (min-width: 1000px) {
        [data-testid="SideNav_NewTweet_Button"] {
          position: fixed !important;
          right: 16px;
          bottom: 16px;
          z-index: 2000;
        }
      }
    `,
    defaultEnabled: true,
  },
] satisfies Option[];

function flattenOptions(options: readonly Option[]): Option[] {
  return options.flatMap((option) => [
    option,
    ...flattenOptions(option.children ?? []),
  ]);
}

export const OPTIONS = flattenOptions(OPTION_HIERARCHY);

export const QUICK_ACTION_POSITIONS = ["left", "right"] as const;

export type QuickActionPosition = (typeof QUICK_ACTION_POSITIONS)[number];

export type ToggleId =
  | OptionId
  | "quickActionsEnabled"
  | "quickActionsMuteEnabled"
  | "quickActionsBlockEnabled"
  | "quickActionsNotInterestedEnabled";

export type Settings = Record<ToggleId, boolean> & {
  quickActionsPosition: QuickActionPosition;
  hideAffiliatedOrgTweetsOrgs: string;
};

export type RawSettings = Partial<Record<keyof Settings, unknown>>;

const DEFAULT_SETTINGS: Settings = {
  ...Object.fromEntries(
    OPTIONS.map((option) => [option.id, option.defaultEnabled]),
  ) as Record<OptionId, boolean>,
  quickActionsEnabled: true,
  quickActionsPosition: "right",
  quickActionsMuteEnabled: true,
  quickActionsBlockEnabled: true,
  quickActionsNotInterestedEnabled: true,
  hideAffiliatedOrgTweetsOrgs: "",
};

function normalizeSettings(input: RawSettings): Settings {
  const settings = Object.fromEntries(
    Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) => {
      const value = input[key as keyof Settings];
      return [key, typeof value === typeof fallback ? value : fallback];
    }),
  ) as Settings;

  if (!QUICK_ACTION_POSITIONS.includes(settings.quickActionsPosition)) {
    settings.quickActionsPosition = DEFAULT_SETTINGS.quickActionsPosition;
  }

  return settings;
}

export function mergeSettings(base: Settings, update: RawSettings): Settings {
  return normalizeSettings({ ...base, ...update });
}

export async function getSettings(): Promise<Settings> {
  return normalizeSettings(await chrome.storage.sync.get(DEFAULT_SETTINGS));
}

export function setSettings(update: Partial<Settings>): Promise<void> {
  return chrome.storage.sync.set(update);
}
