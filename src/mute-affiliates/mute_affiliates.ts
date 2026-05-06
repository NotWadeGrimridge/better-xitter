import { getCookie } from "@/utils.ts";
import { AffiliatesUser, isAffiliatesPathname } from "./shared.ts";

const BUTTON_CONTAINER_ID = "better-xitter-affiliates-mute-buttons";
const POPUP_ID = "better-xitter-affiliates-mute-popup";

let messageHooked = false;
let observer: MutationObserver | null = null;
let latestUserIds: string[] = [];
let lastSeenPathname = "";
let popup: HTMLDivElement | null = null;
let popupTriggerButton: HTMLButtonElement | null = null;
let popupCountEl: HTMLDivElement | null = null;
let popupProgressEl: HTMLDivElement | null = null;
let popupOutsideClickHandler: ((event: MouseEvent) => void) | null = null;
let affiliatesReady = false;

export function configureAffiliatesMuteButtons(enabled: boolean): void {
  teardown();
  if (!enabled) return;
  ensureMessageHook();
  ensureObserver();
  injectIfReady();
}

function ensureMessageHook(): void {
  if (messageHooked) return;
  messageHooked = true;

  addEventListener("message", (event: MessageEvent) => {
    const data = event.data as Record<string, unknown> | null;
    if (!data) return;
    if (data.type !== "better-xitter:affiliates-users") return;
    const users = data.users;
    if (!Array.isArray(users)) return;
    affiliatesReady = true;

    const parsed: AffiliatesUser[] = [];
    for (const user of users) {
      if (typeof user !== "object" || user === null) continue;
      const rest_id = (user as Record<string, unknown>).rest_id;
      const screen_name = (user as Record<string, unknown>).screen_name;
      const name = (user as Record<string, unknown>).name;
      if (typeof rest_id !== "string" || typeof screen_name !== "string") {
        continue;
      }
      parsed.push({
        rest_id,
        screen_name,
        name: typeof name === "string" ? name : undefined,
      });
    }

    latestUserIds = [...new Set(parsed.map((u) => u.rest_id))];
    injectIfReady();
  });

  postMessage({ type: "better-xitter:affiliates-mute-ready" }, "*");
}

function ensureObserver(): void {
  if (observer) return;

  observer = new MutationObserver(() => {
    injectIfReady();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function teardown(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  teardownPopup();
  const existing = document.getElementById(BUTTON_CONTAINER_ID);
  existing?.remove();
}

function isAffiliatesPage(): boolean {
  return isAffiliatesPathname(location.pathname);
}

function injectIfReady(): void {
  if (!isAffiliatesPage()) {
    teardownButtonsOnly();
    return;
  }
  if (!affiliatesReady) return;

  const pathname = location.pathname;
  if (pathname !== lastSeenPathname) {
    lastSeenPathname = pathname;
    latestUserIds = [];
    affiliatesReady = false;
    teardownButtonsOnly();
    teardownPopup();
  }

  const userActionsButton = document.querySelector<HTMLButtonElement>(
    'button[data-testid="userActions"]',
  );
  if (!userActionsButton) return;

  const actionsRow = userActionsButton.parentElement;
  if (!actionsRow) return;

  const rowTestId = actionsRow.getAttribute("data-testid");
  if (rowTestId && !rowTestId.startsWith("UserActions")) return;

  if (document.getElementById(BUTTON_CONTAINER_ID)) return;

  const primaryButton = actionsRow.querySelector<HTMLButtonElement>("button");
  if (!primaryButton) return;

  const container = document.createElement("div");
  container.id = BUTTON_CONTAINER_ID;

  const triggerButton = createTriggerButton(primaryButton);

  container.append(triggerButton);
  actionsRow.insertBefore(container, primaryButton);
}

function teardownButtonsOnly(): void {
  const existing = document.getElementById(BUTTON_CONTAINER_ID);
  existing?.remove();
}

function createTriggerButton(
  referenceButton: HTMLButtonElement,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = referenceButton.className;

  const referenceStyle = referenceButton.getAttribute("style");
  if (referenceStyle !== null) {
    button.setAttribute("style", referenceStyle);
  }

  button.setAttribute("aria-label", "Better Xitter affiliates mute");
  const ns = "http://www.w3.org/2000/svg";
  const mutePath =
    "M18 6.59V1.2L8.71 7H5.5C4.12 7 3 8.12 3 9.5v5C3 15.88 4.12 17 5.5 17h2.09l-2.3 2.29 1.42 1.42 15.5-15.5-1.42-1.42L18 6.59zm-8 8V8.55l6-3.75v3.79l-6 6zM5 9.5c0-.28.22-.5.5-.5H8v6H5.5c-.28 0-.5-.22-.5-.5v-5zm6.5 9.24l1.45-1.45L16 19.2V14l2 .02v8.78l-6.5-4.06z";

  let inner: HTMLElement;
  const referenceInner = referenceButton.firstElementChild;

  if (referenceInner) {
    inner = referenceInner.cloneNode(true) as HTMLElement;
    const svg = inner.querySelector<SVGSVGElement>("svg");
    if (svg) {
      let path = svg.querySelector<SVGPathElement>("path");
      if (!path) {
        path = document.createElementNS(ns, "path");
        svg.append(path);
      }
      path.setAttribute("d", mutePath);
    }
  } else {
    inner = document.createElement("div");
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", mutePath);
    svg.append(path);
    inner.append(svg);
  }

  button.textContent = "";
  button.append(inner);

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    togglePopup(button);
  });

  return button;
}

function togglePopup(triggerButton: HTMLButtonElement): void {
  if (!popup) {
    createPopup();
  }
  if (!popup || !popupCountEl || !popupProgressEl) return;

  popupTriggerButton = triggerButton;

  popupCountEl.textContent = `Affiliates: ${latestUserIds.length}`;
  popupProgressEl.textContent = "";

  const rect = triggerButton.getBoundingClientRect();
  popup.style.position = "fixed";
  popup.style.left = `${Math.round(rect.left)}px`;
  popup.style.top = `${Math.round(rect.bottom + 4)}px`;
  popup.style.display = popup.style.display === "block" ? "none" : "block";
}

function createPopup(): void {
  if (popup) return;

  const div = document.createElement("div");
  div.id = POPUP_ID;
  div.style.position = "fixed";
  div.style.zIndex = "9999";
  div.style.backgroundColor = "white";
  div.style.color = "black";
  div.style.border = "1px solid #ccc";
  div.style.padding = "8px";
  div.style.display = "none";
  div.style.maxWidth = "260px";

  const countEl = document.createElement("div");
  const progressEl = document.createElement("div");
  progressEl.style.marginTop = "4px";

  const buttonsRow = document.createElement("div");
  buttonsRow.style.marginTop = "8px";
  buttonsRow.style.display = "flex";
  buttonsRow.style.gap = "8px";

  const muteButton = document.createElement("button");
  muteButton.type = "button";
  muteButton.textContent = "Mute all";
  muteButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    startMuteAction("mute");
  });

  const unmuteButton = document.createElement("button");
  unmuteButton.type = "button";
  unmuteButton.textContent = "Unmute all";
  unmuteButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    startMuteAction("unmute");
  });

  buttonsRow.append(muteButton, unmuteButton);
  div.append(countEl, progressEl, buttonsRow);

  popup = div;
  popupCountEl = countEl;
  popupProgressEl = progressEl;

  popupOutsideClickHandler = (event: MouseEvent) => {
    if (!popup) return;
    const target = event.target as Node | null;
    if (
      target &&
      (popup.contains(target) ||
        (popupTriggerButton && popupTriggerButton.contains(target)))
    ) {
      return;
    }
    popup.style.display = "none";
  };

  document.addEventListener("click", popupOutsideClickHandler);
  document.body.append(div);
}

function teardownPopup(): void {
  if (popupOutsideClickHandler) {
    document.removeEventListener("click", popupOutsideClickHandler);
    popupOutsideClickHandler = null;
  }

  const existingPopup = document.getElementById(POPUP_ID);
  existingPopup?.remove();

  popup = null;
  popupTriggerButton = null;
  popupCountEl = null;
  popupProgressEl = null;
}

function startMuteAction(action: "mute" | "unmute"): void {
  if (!popupProgressEl) return;

  if (latestUserIds.length === 0) {
    popupProgressEl.textContent =
      "No affiliates found yet (scroll or refresh).";
    return;
  }

  const total = latestUserIds.length;
  const verb = action === "mute" ? "Muting" : "Unmuting";
  popupProgressEl.textContent = `${verb}... 0 / ${total}`;

  void muteOrUnmuteAll(
    action,
    (current, currentTotal) => {
      if (!popupProgressEl) return;
      popupProgressEl.textContent = `${verb}... ${current} / ${currentTotal}`;
    },
    () => {
      if (!popupProgressEl) return;
      popupProgressEl.textContent = action === "mute"
        ? "Muted all"
        : "Unmuted all";
    },
  );
}

async function muteOrUnmuteAll(
  action: "mute" | "unmute",
  onProgress?: (current: number, total: number) => void,
  onDone?: (total: number) => void,
): Promise<void> {
  if (latestUserIds.length === 0) {
    console.warn(
      "[better-xitter] No affiliates users loaded yet (scroll/refresh page).",
    );
    return;
  }

  const endpointPath = action === "mute"
    ? "/i/api/1.1/mutes/users/create.json"
    : "/i/api/1.1/mutes/users/destroy.json";

  const state = initNetState();
  const referrer = location.href;

  for (const [index, userId] of latestUserIds.entries()) {
    if (onProgress) {
      onProgress(index + 1, latestUserIds.length);
    }
    const result = await sendMuteRequest({
      endpointPath,
      userId,
      referrer,
      state,
    });

    if (!result.ok) {
      console.warn(
        `[better-xitter] ${action} failed for user_id=${userId}`,
        result.error ?? result.status,
      );
    }

    // Keep a modest delay to reduce burstiness; also gets overridden by
    // server rate-limit headers when exhausted.
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (onDone) {
    onDone(latestUserIds.length);
  }
}

type NetState = {
  authorization: string;
  ct0: string | null;
  transactionId: string;
};

function updateTransactionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(95));
  return [...bytes].map((x) => {
    const i = ((x / 255) * 61) | 0;
    return String.fromCharCode(
      i + (i > 9 ? (i > 35 ? 61 : 55) : 48),
    );
  }).join("");
}

function initNetState(): NetState {
  return {
    authorization:
      "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
    ct0: getCookie("ct0"),
    transactionId: updateTransactionId(),
  };
}

function buildHeaders(state: NetState): HeadersInit {
  return {
    authorization: state.authorization,
    "content-type": "application/x-www-form-urlencoded",
    "x-client-transaction-id": state.transactionId,
    "x-csrf-token": state.ct0 ?? "",
    "x-twitter-active-user": "yes",
    "x-twitter-auth-type": "OAuth2Session",
  };
}

async function waitForRateLimit(response: Response): Promise<void> {
  const remaining = response.headers.get("x-rate-limit-remaining");
  const reset = response.headers.get("x-rate-limit-reset");
  if (remaining == null || reset == null) return;

  const remainingNum = Number(remaining);
  if (!Number.isFinite(remainingNum) || remainingNum >= 1) return;

  const resetTs = Number(reset);
  if (!Number.isFinite(resetTs) || resetTs <= 0) return;

  const seconds = resetTs - Math.floor(Date.now() / 1000);
  if (seconds > 0) {
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
}

async function sendMuteRequest(input: {
  endpointPath: string;
  userId: string;
  referrer: string;
  state: NetState;
}): Promise<{ ok: true } | { ok: false; status?: number; error?: unknown }> {
  try {
    const response = await fetch(`https://x.com${input.endpointPath}`, {
      headers: buildHeaders(input.state),
      referrer: input.referrer,
      referrerPolicy: "strict-origin-when-cross-origin",
      body: `user_id=${encodeURIComponent(input.userId)}`,
      method: "POST",
      mode: "cors",
      credentials: "include",
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status >= 200 && response.status < 300) {
      await waitForRateLimit(response);
      return { ok: true };
    }

    if (response.status === 429 || response.status === 420) {
      await waitForRateLimit(response);
      return { ok: false, status: response.status };
    }

    return { ok: false, status: response.status };
  } catch (error) {
    return { ok: false, error };
  }
}
