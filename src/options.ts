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
  rule: string;
  selector?: string;
  defaultEnabled: boolean;
  control?: "checkbox" | "select";
  children?: readonly Option[];
};

export const optionHierarchy = [
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
    selector: '[data-testid="sidebarColumn"]',
    rule: "",
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
    selector: "body",
    rule: "",
    defaultEnabled: true,
  },
  {
    id: "showTweetLocationInfo",
    label: "Show country on tweets",
    selector: "body",
    rule: "",
    defaultEnabled: true,
  },
  {
    id: "hideAffiliatedOrgTweets",
    label: "Hide affiliates of chosen orgs",
    selector: "body",
    rule: "",
    defaultEnabled: false,
    children: [
      {
        id: "hideAffiliatedOrgQuoteTweets",
        label: "Also hide quote-tweets of affiliates",
        selector: "body",
        rule: "",
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
    selector: `
      [data-testid="placementTracking"] article,
      a[href*="quick_promote_web"]
    `,
    // The article combinator keeps this from hiding all cards inside placementTracking (e.g. videos).
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

function flattenOptions(
  nodes: readonly Option[],
): Option[] {
  const flattened: Option[] = [];
  for (const node of nodes) {
    flattened.push(node);
    if (node.children?.length) {
      flattened.push(...flattenOptions(node.children));
    }
  }
  return flattened;
}

export const options = flattenOptions(optionHierarchy);

export type QuickActionPosition = "left" | "right";
export type Settings =
  & {
    [K in OptionId]: boolean;
  }
  & {
    quickActionsEnabled: boolean;
    quickActionsPosition: QuickActionPosition;
    quickActionsMuteEnabled: boolean;
    quickActionsBlockEnabled: boolean;
    quickActionsNotInterestedEnabled: boolean;
    hideAffiliatedOrgTweetsOrgs: string;
  };

const optionDefaults = Object.fromEntries(
  options.map((option) => [option.id, option.defaultEnabled]),
) as Record<OptionId, boolean>;

export const defaultSettings: Settings = {
  ...optionDefaults,
  quickActionsEnabled: true,
  quickActionsPosition: "right",
  quickActionsMuteEnabled: true,
  quickActionsBlockEnabled: true,
  quickActionsNotInterestedEnabled: true,
  hideAffiliatedOrgTweetsOrgs: "",
};

const storage: chrome.storage.StorageArea = chrome.storage.sync;

export function getSettings(): Promise<Settings> {
  return new Promise<Settings>((resolve) => {
    storage.get(defaultSettings, (items: Partial<Settings>) => {
      const merged = { ...defaultSettings, ...items } as Settings;
      resolve(merged);
    });
  });
}

export function setSettings(update: Partial<Settings>): Promise<void> {
  return new Promise<void>((resolve) => {
    storage.set(update, () => resolve());
  });
}
