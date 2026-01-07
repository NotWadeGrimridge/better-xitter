/// <reference lib="dom" />

(() => {
  const win = globalThis as unknown as Window & {
    __betterXitterTweetClientInfoInstalled?: boolean;
  };

  if (win.__betterXitterTweetClientInfoInstalled) return;
  win.__betterXitterTweetClientInfoInstalled = true;

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

  function emitFocusedTweetClientInfo(): void {
    const tweetId = getFocusedTweetIdFromPath();
    if (!tweetId) return;

    const state = getReduxState();
    if (!state) return;

    const entities = state.entities as
      | { tweets?: { entities?: Record<string, unknown> } }
      | undefined;
    const tweetEntities = entities?.tweets?.entities;
    if (!tweetEntities) return;

    const info = tweetEntities[tweetId] as
      | { source_name?: unknown }
      | undefined;
    if (!info) return;

    const sourceName = info.source_name;
    if (typeof sourceName !== "string" || sourceName.trim().length === 0) {
      return;
    }

    win.postMessage(
      {
        type: "better-xitter:tweet-client-info",
        tweetId,
        sourceName,
      },
      "*",
    );
  }

  if (/^\/[^/]+\/status\/\d+/.test(win.location?.pathname ?? "")) {
    emitFocusedTweetClientInfo();
  }

  const root = document.body ?? document.documentElement;
  if (!root) return;

  const observer = new MutationObserver(() => {
    if (!/^\/[^/]+\/status\/\d+/.test(win.location?.pathname ?? "")) {
      return;
    }
    emitFocusedTweetClientInfo();
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
  });
})();
