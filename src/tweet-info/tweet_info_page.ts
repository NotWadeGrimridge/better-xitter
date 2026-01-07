/// <reference lib="dom" />

import { fetchGraphqlJson } from "@/utils.ts";

(() => {
  const win = globalThis as unknown as Window & {
    __betterXitterTweetInfoInstalled?: boolean;
  };

  if (win.__betterXitterTweetInfoInstalled) return;
  win.__betterXitterTweetInfoInstalled = true;

  const accountLocationCache = new Map<
    string,
    { account_based_in: string; location_accurate: boolean }
  >();

  function getReduxState(): Record<string, unknown> | null {
    const root = document.querySelector<HTMLElement>("#react-root");
    if (!root) return null;

    const owner = root.firstElementChild as HTMLElement | null;
    if (!owner) return null;

    const keys = Object.keys(
      owner as unknown as Record<string, unknown>,
    );
    const key = keys.find((k) => k.startsWith("__reactProps"));
    if (!key) return null;

    const container = (owner as unknown as Record<string, unknown>)[key] as
      | Record<string, unknown>
      | undefined;
    if (!container) return null;

    const childrenProps =
      (container.children as { props?: unknown } | undefined)
        ?.props as { children?: { props?: unknown } } | undefined;
    const topLevelProps = childrenProps?.children?.props as
      | { store?: { getState?: () => Record<string, unknown> } }
      | undefined;

    const store = topLevelProps?.store;
    const getState = store?.getState as (() => unknown) | undefined;
    if (!getState) return null;

    const state = getState();
    if (!state || typeof state !== "object") return null;
    return state as Record<string, unknown>;
  }

  function getFocusedTweetIdFromPath(): string | null {
    const path = win.location?.pathname ?? "";
    const statusIndex = path.indexOf("/status/");
    if (statusIndex === -1) return null;

    const rest = path.slice(statusIndex + "/status/".length);
    if (!rest) return null;

    let id = "";
    for (let i = 0; i < rest.length; i++) {
      const code = rest.charCodeAt(i);
      if (code >= 48 && code <= 57) {
        id += rest[i];
        continue;
      }
      break;
    }

    if (!id) return null;
    return id;
  }

  async function getAccountLocation(
    screenName: string,
  ): Promise<{ account_based_in: string; location_accurate: boolean } | null> {
    if (accountLocationCache.has(screenName)) {
      return accountLocationCache.get(screenName) ?? null;
    }

    const variables = { screenName };
    const url =
      `/i/api/graphql/XRqGa7EeokUU5kppkh13EA/AboutAccountQuery?variables=${
        encodeURIComponent(JSON.stringify(variables))
      }`;

    const body = await fetchGraphqlJson(url) as {
      data?: {
        user_result_by_screen_name?: {
          result?: {
            about_profile?: {
              account_based_in?: string;
              location_accurate?: boolean;
            };
          };
        };
      };
    };

    if (!body) return null;

    const about = body.data?.user_result_by_screen_name?.result
      ?.about_profile;
    if (
      !about ||
      typeof about.account_based_in !== "string" ||
      about.account_based_in.trim().length === 0
    ) {
      return null;
    }

    const value = {
      account_based_in: about.account_based_in,
      location_accurate: Boolean(about.location_accurate),
    };
    accountLocationCache.set(screenName, value);
    return value;
  }

  async function emitFocusedTweetInfo(): Promise<void> {
    const tweetId = getFocusedTweetIdFromPath();
    if (!tweetId) return;

    const state = getReduxState();
    if (!state) return;

    const entities = state.entities as
      | {
        tweets?: { entities?: Record<string, unknown> };
      }
      | undefined;
    const tweetEntities = entities?.tweets?.entities;
    if (!tweetEntities) return;

    const info = tweetEntities[tweetId] as
      | {
        source_name?: unknown;
        core?: {
          user_results?: {
            result?: {
              core?: {
                screen_name?: unknown;
              };
            };
          };
        };
      }
      | undefined;
    if (!info) return;

    const sourceName = info.source_name;
    if (typeof sourceName !== "string" || sourceName.trim().length === 0) {
      return;
    }

    const path = win.location?.pathname ?? "";
    const match = path.match(/^\/([^/]+)\/status\/\d+/);
    const screenName = match ? match[1] : null;
    let location:
      | { account_based_in: string; location_accurate: boolean }
      | null = null;

    if (typeof screenName === "string" && screenName.length > 0) {
      location = await getAccountLocation(screenName);
    }

    win.postMessage(
      {
        type: "better-xitter:tweet-info",
        tweetId,
        sourceName,
        accountBasedIn: location?.account_based_in ?? null,
        locationAccurate: location?.location_accurate ?? null,
      },
      "*",
    );
  }

  if (/^\/[^/]+\/status\/\d+/.test(win.location?.pathname ?? "")) {
    void emitFocusedTweetInfo();
  }

  const root = document.body ?? document.documentElement;
  if (!root) return;

  const observer = new MutationObserver(() => {
    if (!/^\/[^/]+\/status\/\d+/.test(win.location?.pathname ?? "")) {
      return;
    }
    void emitFocusedTweetInfo();
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
  });
})();
