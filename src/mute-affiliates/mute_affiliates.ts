import { delay } from "@std/async/delay";
import {
  BEARER_TOKEN,
  getCookie,
  isAffiliatesPathname,
  MUTE_ICON_PATH,
  SVG_NAMESPACE,
} from "@/utils.ts";

const BUTTON_CONTAINER_ID = "better-xitter-affiliates-mute-buttons";
const POPUP_ID = "better-xitter-affiliates-mute-popup";
const REQUEST_INTERVAL_MS = 100;
const REQUEST_TIMEOUT_MS = 10_000;
const TRANSACTION_ID_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

type MuteAction = "mute" | "unmute";

type Popup = {
  root: HTMLDivElement;
  count: HTMLDivElement;
  progress: HTMLDivElement;
};

const userIdsByPathname = new Map<string, string[]>();

let popup: Popup | null = null;

export function configureAffiliatesMuteButtons(): void {
  addEventListener("message", (event: MessageEvent) => {
    const { data } = event;
    if (data?.type !== "better-xitter:affiliates-users") return;
    if (typeof data.pathname !== "string" || !Array.isArray(data.userIds)) {
      return;
    }

    userIdsByPathname.set(data.pathname, [
      ...new Set<string>(
        data.userIds.filter((id: unknown) => typeof id === "string"),
      ),
    ]);
    injectButton();
  });

  document.addEventListener("click", (event) => {
    if (popup && !popup.root.contains(event.target as Node)) {
      popup.root.style.display = "none";
    }
  });

  new MutationObserver(injectButton).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  postMessage({ type: "better-xitter:affiliates-mute-ready" }, "*");
  injectButton();
}

function injectButton(): void {
  const { pathname } = location;

  const existing = document.querySelector<HTMLElement>(
    `#${BUTTON_CONTAINER_ID}`,
  );
  if (existing?.dataset.pathname === pathname) return;

  existing?.remove();
  removePopup();

  if (!isAffiliatesPathname(pathname) || !userIdsByPathname.has(pathname)) {
    return;
  }

  const actionsRow = document.querySelector(
    'button[data-testid="userActions"]',
  )?.parentElement;
  if (!actionsRow) return;

  const rowTestId = actionsRow.dataset.testid;
  if (rowTestId && !rowTestId.startsWith("UserActions")) return;

  const primaryButton = actionsRow.querySelector("button");
  if (!primaryButton) return;

  const container = document.createElement("div");
  container.id = BUTTON_CONTAINER_ID;
  container.dataset.pathname = pathname;
  container.append(createTriggerButton(primaryButton));
  primaryButton.before(container);
}

function createTriggerButton(
  referenceButton: HTMLButtonElement,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = referenceButton.className;
  button.ariaLabel = "Better Xitter affiliates mute";

  const referenceStyle = referenceButton.getAttribute("style");
  if (referenceStyle !== null) button.setAttribute("style", referenceStyle);

  let content = referenceButton.firstElementChild?.cloneNode(true) as
    | Element
    | undefined;
  if (!content) {
    const fallbackSvg = document.createElementNS(SVG_NAMESPACE, "svg");
    fallbackSvg.setAttribute("viewBox", "0 0 24 24");
    fallbackSvg.setAttribute("width", "20");
    fallbackSvg.setAttribute("height", "20");

    content = document.createElement("div");
    content.append(fallbackSvg);
  }

  const svg = content.querySelector("svg");
  if (svg) {
    let path = svg.querySelector("path");
    if (!path) {
      path = document.createElementNS(SVG_NAMESPACE, "path");
      svg.append(path);
    }
    path.setAttribute("d", MUTE_ICON_PATH);
  }

  button.append(content);

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    togglePopup(button);
  });

  return button;
}

function togglePopup(triggerButton: HTMLButtonElement): void {
  popup ??= createPopup();
  const userIds = userIdsByPathname.get(location.pathname) ?? [];
  popup.count.textContent = `Affiliates: ${userIds.length}`;
  popup.progress.textContent = "";

  const rect = triggerButton.getBoundingClientRect();
  const { style } = popup.root;
  style.left = `${Math.round(rect.left)}px`;
  style.top = `${Math.round(rect.bottom + 4)}px`;
  style.display = style.display === "block" ? "none" : "block";
}

function createPopup(): Popup {
  const root = document.createElement("div");
  root.id = POPUP_ID;
  root.style.cssText = `
    position: fixed;
    z-index: 9999;
    display: none;
    max-width: 260px;
    padding: 8px;
    border: 1px solid #ccc;
    background-color: white;
    color: black;
  `;

  const count = document.createElement("div");

  const progress = document.createElement("div");
  progress.style.marginTop = "4px";

  const buttons = document.createElement("div");
  buttons.style.cssText = "display: flex; gap: 8px; margin-top: 8px";

  for (const action of ["mute", "unmute"] as const) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action === "mute" ? "Mute all" : "Unmute all";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      runMuteAction(action, progress);
    });
    buttons.append(button);
  }

  root.append(count, progress, buttons);
  document.body.append(root);

  return { root, count, progress };
}

function removePopup(): void {
  popup?.root.remove();
  popup = null;
}

async function runMuteAction(
  action: MuteAction,
  progress: HTMLElement,
): Promise<void> {
  const targets = userIdsByPathname.get(location.pathname) ?? [];
  if (targets.length === 0) {
    progress.textContent = "No affiliates found yet (scroll or refresh).";
    return;
  }

  const verb = action === "mute" ? "Muting" : "Unmuting";
  const headers = {
    "authorization": BEARER_TOKEN,
    "content-type": "application/x-www-form-urlencoded",
    "x-client-transaction-id": createTransactionId(),
    "x-csrf-token": getCookie("ct0") ?? "",
    "x-twitter-active-user": "yes",
    "x-twitter-auth-type": "OAuth2Session",
  };

  for (const [index, userId] of targets.entries()) {
    progress.textContent = `${verb}... ${index + 1} / ${targets.length}`;
    // oxlint-disable-next-line no-await-in-loop -- One request at a time, to respect X's rate limits.
    await sendMuteRequest(action, userId, headers);
  }

  progress.textContent = action === "mute" ? "Muted all" : "Unmuted all";
}

async function sendMuteRequest(
  action: MuteAction,
  userId: string,
  headers: HeadersInit,
): Promise<void> {
  const endpoint = action === "mute" ? "create" : "destroy";

  try {
    const response = await fetch(
      `https://x.com/i/api/1.1/mutes/users/${endpoint}.json`,
      {
        method: "POST",
        headers,
        body: new URLSearchParams({ user_id: userId }),
        credentials: "include",
        referrer: location.href,
        referrerPolicy: "strict-origin-when-cross-origin",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      console.warn(
        `[better-xitter] ${action} failed for user_id=${userId}`,
        response.status,
      );
    }

    if (response.ok || response.status === 420 || response.status === 429) {
      await waitForRateLimitReset(response);
    }
  } catch (error) {
    console.warn(
      `[better-xitter] ${action} failed for user_id=${userId}`,
      error,
    );
  }

  await delay(REQUEST_INTERVAL_MS);
}

function createTransactionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(95));
  const lastIndex = TRANSACTION_ID_ALPHABET.length - 1;

  return [...bytes]
    .map((byte) =>
      TRANSACTION_ID_ALPHABET[Math.trunc((byte / 255) * lastIndex)]
    )
    .join("");
}

async function waitForRateLimitReset(response: Response): Promise<void> {
  const remaining = Number(
    response.headers.get("x-rate-limit-remaining") ?? Number.NaN,
  );
  const resetAt = Number(
    response.headers.get("x-rate-limit-reset") ?? Number.NaN,
  );
  const secondsUntilReset = resetAt - Math.floor(Date.now() / 1000);

  if (remaining < 1 && resetAt > 0 && secondsUntilReset > 0) {
    await delay(secondsUntilReset * 1000);
  }
}
