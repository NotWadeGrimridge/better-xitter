const HOOK_SCRIPT_ID = "better-xitter-home-timeline-xhr-hook";

async function ensureHomeTimelineHookRegistered(): Promise<void> {
  const scripts = await chrome.scripting.getRegisteredContentScripts();
  if (scripts.some((script) => script.id === HOOK_SCRIPT_ID)) return;

  await chrome.scripting.registerContentScripts([
    {
      id: HOOK_SCRIPT_ID,
      js: ["home_timeline_xhr_hook.js"],
      matches: ["https://x.com/*"],
      runAt: "document_start",
      world: "MAIN",
    },
  ]);
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
