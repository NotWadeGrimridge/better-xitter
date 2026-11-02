import { delay } from "@std/async/delay";
import type { QuickActionPosition } from "@/options.ts";
import { isInHomeTimeline, MUTE_ICON_PATH, SVG_NAMESPACE } from "@/utils.ts";

const TWEET_BUTTONS_ID = "better-xitter-ocmb-buttons";
const FOLLOWER_BUTTONS_ID = "better-xitter-follower-buttons";
const BUTTON_SIZE = 18;
const BUTTON_GAP = 8;
const ICON_COLOR = "rgb(113 118 123)";
const MENU_DELAY_MS = 100;
const PREMIUM_MODAL_DELAY_MS = 500;

const TWEET_MENU_SELECTOR = '[aria-haspopup="menu"][data-testid="caret"]';
const USER_MENU_SELECTOR = '[aria-haspopup="menu"]';
const USER_CELL_SELECTOR = 'button[data-testid="UserCell"]';
const FOLLOWER_PAGE_SECTIONS = new Set([
  "followers",
  "following",
  "verified_followers",
]);

const BLOCK_ICON_PATH =
  "M12 3.75c-4.55 0-8.25 3.69-8.25 8.25 0 1.92.66 3.68 1.75 5.08L17.09 5.5C15.68 4.4 13.92 3.75 12 3.75zm6.5 3.17L6.92 18.5c1.4 1.1 3.16 1.75 5.08 1.75 4.56 0 8.25-3.69 8.25-8.25 0-1.92-.65-3.68-1.75-5.08zM1.75 12C1.75 6.34 6.34 1.75 12 1.75S22.25 6.34 22.25 12 17.66 22.25 12 22.25 1.75 17.66 1.75 12z";
const REMOVE_FOLLOWER_ICON_PATH =
  "M10 4c-1.105 0-2 .9-2 2s.895 2 2 2 2-.9 2-2-.895-2-2-2zM6 6c0-2.21 1.791-4 4-4s4 1.79 4 4-1.791 4-4 4-4-1.79-4-4zm12.586 3l-2.043-2.04 1.414-1.42L20 7.59l2.043-2.05 1.414 1.42L21.414 9l2.043 2.04-1.414 1.42L20 10.41l-2.043 2.05-1.414-1.42L18.586 9zM3.651 19h12.698c-.337-1.8-1.023-3.21-1.945-4.19C13.318 13.65 11.838 13 10 13s-3.317.65-4.404 1.81c-.922.98-1.608 2.39-1.945 4.19zm.486-5.56C5.627 11.85 7.648 11 10 11s4.373.85 5.863 2.44c1.477 1.58 2.366 3.8 2.632 6.46l.11 1.1H1.395l.11-1.1c.266-2.66 1.155-4.88 2.632-6.46z";
const NOT_INTERESTED_ICON_PATH =
  "M9.5 7c.828 0 1.5 1.119 1.5 2.5S10.328 12 9.5 12 8 10.881 8 9.5 8.672 7 9.5 7zm5 0c.828 0 1.5 1.119 1.5 2.5s-.672 2.5-1.5 2.5S13 10.881 13 9.5 13.672 7 14.5 7zM12 22.25C6.348 22.25 1.75 17.652 1.75 12S6.348 1.75 12 1.75 22.25 6.348 22.25 12 17.652 22.25 12 22.25zm0-18.5c-4.549 0-8.25 3.701-8.25 8.25s3.701 8.25 8.25 8.25 8.25-3.701 8.25-8.25S16.549 3.75 12 3.75zM8.947 17.322l-1.896-.638C7.101 16.534 8.322 13 12 13s4.898 3.533 4.949 3.684l-1.897.633c-.031-.09-.828-2.316-3.051-2.316s-3.021 2.227-3.053 2.322z";

export type QuickMuteBlockConfig = {
  enabled: boolean;
  position: QuickActionPosition;
  showMute: boolean;
  showBlock: boolean;
  showNotInterested: boolean;
};

type MenuAction = {
  title: string;
  iconPath: string;
  menuItemLabel: string;
  exactLabel?: boolean;
  confirm?: boolean;
  closePremiumModal?: boolean;
};

const NOT_INTERESTED_ACTION: MenuAction = {
  title: "Not interested",
  iconPath: NOT_INTERESTED_ICON_PATH,
  menuItemLabel: "Not interested in this post",
  exactLabel: true,
};

const MUTE_ACTION: MenuAction = {
  title: "Mute",
  iconPath: MUTE_ICON_PATH,
  menuItemLabel: "Mute",
};

const BLOCK_ACTION: MenuAction = {
  title: "Block",
  iconPath: BLOCK_ICON_PATH,
  menuItemLabel: "Block",
  confirm: true,
  closePremiumModal: true,
};

const REMOVE_FOLLOWER_ACTION: MenuAction = {
  title: "Remove follower",
  iconPath: REMOVE_FOLLOWER_ICON_PATH,
  menuItemLabel: "Remove",
  confirm: true,
};

let observer: MutationObserver | null = null;

export function configureQuickMuteBlock(config: QuickMuteBlockConfig): void {
  observer?.disconnect();
  observer = null;

  const rows = document.querySelectorAll(
    `#${TWEET_BUTTONS_ID}, #${FOLLOWER_BUTTONS_ID}`,
  );
  for (const row of rows) row.remove();

  if (!config.enabled) return;

  injectAll(document.documentElement, config);

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) injectAll(node, config);
      }
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function injectAll(root: HTMLElement, config: QuickMuteBlockConfig): void {
  if (root.tagName === "ARTICLE") {
    injectTweetButtons(root, config);
    return;
  }

  for (const tweet of root.querySelectorAll<HTMLElement>("article")) {
    injectTweetButtons(tweet, config);
  }

  const [, section = ""] = location.pathname.split("/").filter(Boolean);
  if (!FOLLOWER_PAGE_SECTIONS.has(section)) return;

  if (root.matches(USER_CELL_SELECTOR)) injectFollowerButtons(root, config);
  for (
    const userCell of root.querySelectorAll<HTMLElement>(USER_CELL_SELECTOR)
  ) {
    injectFollowerButtons(userCell, config);
  }
}

function injectTweetButtons(
  tweet: HTMLElement,
  config: QuickMuteBlockConfig,
): void {
  const nameContainer = tweet.querySelector<HTMLElement>(
    'div[data-testid="User-Name"]',
  );
  if (!nameContainer || tweet.querySelector(`#${TWEET_BUTTONS_ID}`)) return;

  const actions: MenuAction[] = [];
  if (config.showNotInterested && isInHomeTimeline(tweet)) {
    actions.push(NOT_INTERESTED_ACTION);
  }
  if (config.showMute) actions.push(MUTE_ACTION);
  if (config.showBlock) actions.push(BLOCK_ACTION);
  if (actions.length === 0) return;

  const row = createButtonRow(
    TWEET_BUTTONS_ID,
    actions.map((action) =>
      createActionButton(action, tweet, TWEET_MENU_SELECTOR)
    ),
  );
  row.style.paddingLeft = `${BUTTON_GAP}px`;

  placeTweetButtons(nameContainer, row, config.position);
}

function injectFollowerButtons(
  userCell: HTMLElement,
  config: QuickMuteBlockConfig,
): void {
  if (userCell.querySelector(`#${FOLLOWER_BUTTONS_ID}`)) return;

  const menuWrapper = userCell.querySelector(USER_MENU_SELECTOR)?.parentElement;
  if (!menuWrapper?.parentElement) return;

  const actions: MenuAction[] = [];
  if (config.showMute) actions.push(MUTE_ACTION);
  if (config.showBlock) actions.push(BLOCK_ACTION);
  actions.push(REMOVE_FOLLOWER_ACTION);

  const row = createButtonRow(
    FOLLOWER_BUTTONS_ID,
    actions.map((action) =>
      createActionButton(action, userCell, USER_MENU_SELECTOR)
    ),
  );
  row.style.marginLeft = `${BUTTON_GAP}px`;

  menuWrapper.before(row);
}

function placeTweetButtons(
  nameContainer: HTMLElement,
  row: HTMLElement,
  position: QuickActionPosition,
): void {
  if (position === "right") {
    const column = nameContainer.parentElement?.parentElement
      ?.nextElementSibling?.firstElementChild;
    if (column) {
      column.prepend(row);
      return;
    }
  }

  const isColumn = getComputedStyle(nameContainer).flexDirection === "column";
  const target = isColumn ? nameContainer.firstElementChild : null;
  (target ?? nameContainer).append(row);
}

function createButtonRow(id: string, buttons: HTMLElement[]): HTMLDivElement {
  const row = document.createElement("div");
  row.id = id;
  row.style.cssText =
    `display: flex; align-items: center; gap: ${BUTTON_GAP}px`;
  row.append(...buttons);
  return row;
}

function createActionButton(
  action: MenuAction,
  container: HTMLElement,
  menuSelector: string,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.title = action.title;
  button.style.cssText = `
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: ${BUTTON_SIZE}px;
    height: ${BUTTON_SIZE}px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 50%;
  `;

  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", `${BUTTON_SIZE}px`);
  svg.setAttribute("height", `${BUTTON_SIZE}px`);

  const path = document.createElementNS(SVG_NAMESPACE, "path");
  path.setAttribute("d", action.iconPath);
  path.setAttribute("fill", ICON_COLOR);

  svg.append(path);
  button.append(svg);

  button.addEventListener("mouseenter", () => {
    button.style.backgroundColor = "rgba(255, 0, 17, 0.2)";
  });
  button.addEventListener("mouseleave", () => {
    button.style.backgroundColor = "";
  });
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    runMenuAction(action, container, menuSelector);
  });

  return button;
}

async function runMenuAction(
  action: MenuAction,
  container: HTMLElement,
  menuSelector: string,
): Promise<void> {
  const menuButton = container.querySelector<HTMLElement>(menuSelector);
  if (!menuButton) return;

  menuButton.click();
  await delay(MENU_DELAY_MS);

  const menuItems = document.querySelectorAll<HTMLElement>(
    'div[role="menuitem"]',
  );
  const menuItem = [...menuItems].find((item) => {
    const text = item.textContent?.trim() ?? "";
    return action.exactLabel
      ? text === action.menuItemLabel
      : text.startsWith(action.menuItemLabel);
  });
  menuItem?.click();

  if (action.confirm) {
    await delay(MENU_DELAY_MS);
    document
      .querySelector<HTMLElement>('[data-testid="confirmationSheetConfirm"]')
      ?.click();
  }

  if (action.closePremiumModal) {
    await delay(PREMIUM_MODAL_DELAY_MS);
    document
      .querySelector<HTMLElement>('button[data-testid="app-bar-close"]')
      ?.click();
  }
}
