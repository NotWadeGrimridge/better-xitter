type OptionDefinition = {
  id: string;
  label: string;
  rule: string;
  selector?: string;
  defaultEnabled: boolean;
  control?: "checkbox" | "select";
  children?: readonly OptionDefinition[];
};

export const optionHierarchy = [
  {
    id: "hideRightSidebar",
    label: "Hide right sidebar",
    selector: '[data-testid="sidebarColumn"]',
    rule: "display: none !important",
    defaultEnabled: false,
    children: [
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
    ],
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
      header[role="banner"] nav[role="navigation"] > * > div > div + div:last-child {
        display: none !important;
      }
      [data-testid="SideNav_AccountSwitcher_Button"] > div:not(:first-child) {
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
];

function flattenOptions(
  nodes: readonly OptionDefinition[],
): OptionDefinition[] {
  const flattened: OptionDefinition[] = [];
  for (const node of nodes) {
    flattened.push(node);
    if (node.children?.length) {
      flattened.push(...flattenOptions(node.children));
    }
  }
  return flattened;
}

export const options = flattenOptions(optionHierarchy);

export type Option = OptionDefinition & { selector?: string };
export type OptionId = Option["id"];
export type QuickActionPosition = "left" | "right";
export type QuickSettings = {
  quickActionsEnabled: boolean;
  quickActionsPosition: QuickActionPosition;
};
export type Settings = {
  [key: string]: boolean | QuickActionPosition | string;
  quickActionsEnabled: boolean;
  quickActionsPosition: QuickActionPosition;
  hideAffiliatedOrgTweets: boolean;
  hideAffiliatedOrgTweetsOrgs: string;
  hideAffiliatedOrgQuoteTweets: boolean;
  showTweetClientInfo: boolean;
  showTweetLocationInfo: boolean;
};

const optionDefaults = options.reduce(
  (acc, option) => ({ ...acc, [option.id]: option.defaultEnabled }),
  {} as Record<string, boolean>,
);

export const defaultSettings: Settings = {
  ...optionDefaults,
  quickActionsEnabled: true,
  quickActionsPosition: "right",
  hideAffiliatedOrgTweets: false,
  hideAffiliatedOrgTweetsOrgs: "",
  hideAffiliatedOrgQuoteTweets: false,
  showTweetClientInfo: true,
  showTweetLocationInfo: true,
};

const storage: chrome.storage.StorageArea = chrome.storage.sync;

export async function getSettings(): Promise<Settings> {
  return await new Promise((resolve) => {
    storage.get(defaultSettings, (items: Partial<Settings>) => {
      const merged = { ...defaultSettings, ...items } as Settings;
      resolve(merged);
    });
  });
}

export async function setSettings(update: Partial<Settings>): Promise<void> {
  await new Promise<void>((resolve) => {
    storage.set(update, () => resolve());
  });
}
