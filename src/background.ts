const HOOK_SCRIPT_ID = "better-xitter-home-timeline-xhr-hook";
const AFFILIATES_HOOK_SCRIPT_ID = "better-xitter-affiliates-page-xhr-hook";
const AFFILIATES_PAGE_MATCHES = ["https://x.com/*/affiliates*"];

async function ensureHomeTimelineHookRegistered(): Promise<void> {
  const scripts = await chrome.scripting.getRegisteredContentScripts();
  const hasHome = scripts.some((script) => script.id === HOOK_SCRIPT_ID);
  const affiliatesScript = scripts.find((script) =>
    script.id === AFFILIATES_HOOK_SCRIPT_ID
  );
  const hasAffiliates = Boolean(affiliatesScript);
  const affiliatesMatchesOk = Boolean(
    affiliatesScript &&
      JSON.stringify(affiliatesScript.matches) ===
        JSON.stringify(AFFILIATES_PAGE_MATCHES),
  );
  if (hasHome && hasAffiliates && affiliatesMatchesOk) return;

  const toRegister: chrome.scripting.RegisteredContentScript[] = [];

  if (!hasHome) {
    toRegister.push({
      id: HOOK_SCRIPT_ID,
      js: ["hide-affiliates/home_timeline_xhr_hook.js"],
      matches: ["https://x.com/*"],
      runAt: "document_start",
      world: "MAIN",
    });
  }

  if (hasAffiliates && !affiliatesMatchesOk) {
    await chrome.scripting.unregisterContentScripts({
      ids: [AFFILIATES_HOOK_SCRIPT_ID],
    });
  }

  if (!hasAffiliates || !affiliatesMatchesOk) {
    toRegister.push({
      id: AFFILIATES_HOOK_SCRIPT_ID,
      js: ["mute-affiliates/affiliates_page_xhr_hook.js"],
      matches: AFFILIATES_PAGE_MATCHES,
      runAt: "document_start",
      world: "MAIN",
    });
  }

  if (toRegister.length === 0) return;
  await chrome.scripting.registerContentScripts(toRegister);
}

ensureHomeTimelineHookRegistered().catch((error) => {
  console.warn("[better-xitter] Failed to register HomeTimeline hook", error);
});

chrome.runtime.onInstalled.addListener(() => {
  ensureHomeTimelineHookRegistered().catch((error) => {
    console.warn("[better-xitter] Failed to register HomeTimeline hook", error);
  });
});

chrome.runtime.onStartup.addListener(() => {
  ensureHomeTimelineHookRegistered().catch((error) => {
    console.warn("[better-xitter] Failed to register HomeTimeline hook", error);
  });
});
