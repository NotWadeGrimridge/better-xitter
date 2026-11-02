import { debounce } from "@std/async/debounce";
import { fetchGraphqlJson, getPath } from "@/utils.ts";

((): void => {
  const INSTALLED_FLAG = "__betterXitterTweetInfoInstalled";
  const STATUS_PATH_PATTERN =
    /^\/(?<screenName>[^/]+)\/status\/(?<tweetId>\d+)/u;

  const page = globalThis as unknown as Record<string, unknown>;
  if (page[INSTALLED_FLAG]) return;
  page[INSTALLED_FLAG] = true;

  type AccountLocation = { basedIn: string; accurate: boolean };

  const accountLocations = new Map<string, AccountLocation>();

  function getReduxState(): unknown {
    const owner = document.querySelector("#react-root")?.firstElementChild;
    if (!owner) return null;

    const propsKey = Object.keys(owner).find((key) =>
      key.startsWith("__reactProps")
    );
    if (!propsKey) return null;

    const store = getPath(owner, [
      propsKey,
      "children",
      "props",
      "children",
      "props",
      "store",
    ]) as { getState?: () => unknown } | undefined;

    return store?.getState?.() ?? null;
  }

  async function getAccountLocation(
    screenName: string,
  ): Promise<AccountLocation | null> {
    const cached = accountLocations.get(screenName);
    if (cached) return cached;

    const variables = encodeURIComponent(JSON.stringify({ screenName }));
    const body = await fetchGraphqlJson(
      `/i/api/graphql/XRqGa7EeokUU5kppkh13EA/AboutAccountQuery?variables=${variables}`,
    );
    const about = getPath(body, [
      "data",
      "user_result_by_screen_name",
      "result",
      "about_profile",
    ]);

    const basedIn = getPath(about, ["account_based_in"]);
    if (typeof basedIn !== "string" || !basedIn.trim()) return null;

    const accountLocation = {
      basedIn,
      accurate: Boolean(getPath(about, ["location_accurate"])),
    };
    accountLocations.set(screenName, accountLocation);
    return accountLocation;
  }

  async function emitFocusedTweetInfo(): Promise<void> {
    const { screenName, tweetId } =
      STATUS_PATH_PATTERN.exec(location.pathname)?.groups ?? {};
    if (!screenName || !tweetId) return;
    const sourceName = getPath(getReduxState(), [
      "entities",
      "tweets",
      "entities",
      tweetId,
      "source_name",
    ]);
    if (typeof sourceName !== "string" || !sourceName.trim()) return;

    const accountLocation = await getAccountLocation(screenName);

    postMessage(
      {
        type: "better-xitter:tweet-info",
        tweetId,
        sourceName,
        accountBasedIn: accountLocation?.basedIn ?? null,
        locationAccurate: accountLocation?.accurate ?? null,
      },
      "*",
    );
  }

  const emitFocusedTweetInfoSoon = debounce(emitFocusedTweetInfo, 100);

  emitFocusedTweetInfo();

  new MutationObserver((): void => {
    if (STATUS_PATH_PATTERN.test(location.pathname)) emitFocusedTweetInfoSoon();
  }).observe(document.body ?? document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
