/// <reference lib="dom" />

const BUTTON_CONTAINER_ID = "better-xitter-ocmb-buttons";
const BUTTON_SIZE = 18;
const ICON_COLOR = "rgb(113 118 123)";
const BUTTON_GAP = 8;
const BUTTON_PADDING = 0;
const BUTTON_LEFT_PADDING = 8;
const MENU_DELAY_MS = 100;
const PROMO_CLOSE_DELAY_MS = 500;

const MUTE_PATH =
  "M18 6.59V1.2L8.71 7H5.5C4.12 7 3 8.12 3 9.5v5C3 15.88 4.12 17 5.5 17h2.09l-2.3 2.29 1.42 1.42 15.5-15.5-1.42-1.42L18 6.59zm-8 8V8.55l6-3.75v3.79l-6 6zM5 9.5c0-.28.22-.5.5-.5H8v6H5.5c-.28 0-.5-.22-.5-.5v-5zm6.5 9.24l1.45-1.45L16 19.2V14l2 .02v8.78l-6.5-4.06z";
const BLOCK_PATH =
  "M12 3.75c-4.55 0-8.25 3.69-8.25 8.25 0 1.92.66 3.68 1.75 5.08L17.09 5.5C15.68 4.4 13.92 3.75 12 3.75zm6.5 3.17L6.92 18.5c1.4 1.1 3.16 1.75 5.08 1.75 4.56 0 8.25-3.69 8.25-8.25 0-1.92-.65-3.68-1.75-5.08zM1.75 12C1.75 6.34 6.34 1.75 12 1.75S22.25 6.34 22.25 12 17.66 22.25 12 22.25 1.75 17.66 1.75 12z";
const NOT_INTERESTED_IN_POST_PATH =
  "M9.5 7c.828 0 1.5 1.119 1.5 2.5S10.328 12 9.5 12 8 10.881 8 9.5 8.672 7 9.5 7zm5 0c.828 0 1.5 1.119 1.5 2.5s-.672 2.5-1.5 2.5S13 10.881 13 9.5 13.672 7 14.5 7zM12 22.25C6.348 22.25 1.75 17.652 1.75 12S6.348 1.75 12 1.75 22.25 6.348 22.25 12 17.652 22.25 12 22.25zm0-18.5c-4.549 0-8.25 3.701-8.25 8.25s3.701 8.25 8.25 8.25 8.25-3.701 8.25-8.25S16.549 3.75 12 3.75zM8.947 17.322l-1.896-.638C7.101 16.534 8.322 13 12 13s4.898 3.533 4.949 3.684l-1.897.633c-.031-.09-.828-2.316-3.051-2.316s-3.021 2.227-3.053 2.322z";

export type QuickMuteBlockPosition = "left" | "right";
export type QuickMuteBlockConfig = {
  enabled: boolean;
  position: QuickMuteBlockPosition;
};

let currentConfig: QuickMuteBlockConfig = {
  enabled: true,
  position: "left",
};

let observer: MutationObserver | null = null;

export function configureQuickMuteBlock(config: QuickMuteBlockConfig): void {
  teardown();
  currentConfig = config;

  if (!config.enabled) return;

  const tweets = document.querySelectorAll<HTMLElement>("article");
  for (const tweet of tweets) {
    injectButtons(tweet);
  }
  ensureObserver();
}

function ensureObserver(): void {
  if (observer) return;

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList" || mutation.addedNodes.length === 0) {
        continue;
      }

      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const element = node as HTMLElement;

        if (element.tagName === "ARTICLE") {
          injectButtons(element);
          continue;
        }

        const nestedTweets = element.querySelectorAll<HTMLElement>("article");
        for (const tweet of nestedTweets) {
          injectButtons(tweet);
        }
      }
    }
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

  const rows = document.querySelectorAll<HTMLElement>(
    `#${BUTTON_CONTAINER_ID}`,
  );
  for (const row of rows) {
    row.remove();
  }
}

function injectButtons(tweet: HTMLElement): void {
  const nameContainer = tweet.querySelector<HTMLElement>(
    'div[data-testid="User-Name"]',
  );
  if (!nameContainer) return;

  const existing = tweet.querySelector(`#${BUTTON_CONTAINER_ID}`);
  if (existing) return;

  const buttonRow = document.createElement("div");
  buttonRow.id = BUTTON_CONTAINER_ID;
  buttonRow.style.display = "flex";
  buttonRow.style.alignItems = "center";
  buttonRow.style.gap = `${BUTTON_GAP}px`;
  buttonRow.style.paddingLeft = `${BUTTON_LEFT_PADDING}px`;
  buttonRow.style.marginRight = currentConfig.position === "right"
    ? `${BUTTON_GAP}px`
    : "0";

  const muteButton = buildActionButton({
    title: "Mute",
    path: MUTE_PATH,
    onClick: () => handleMute(tweet),
  });
  const blockButton = buildActionButton({
    title: "Block",
    path: BLOCK_PATH,
    onClick: () => handleBlock(tweet),
  });

  if (isInHomeTimeline(tweet)) {
    const notInterestedButton = buildActionButton({
      title: "Not interested",
      path: NOT_INTERESTED_IN_POST_PATH,
      onClick: () => handleNotInterested(tweet),
    });
    buttonRow.append(notInterestedButton);
  }

  buttonRow.append(muteButton, blockButton);

  placeButtons(nameContainer, buttonRow, currentConfig.position);
}

function isInHomeTimeline(tweet: HTMLElement): boolean {
  return Boolean(
    tweet.closest('div[aria-label="Timeline: Your Home Timeline"]'),
  );
}

function placeButtons(
  nameContainer: HTMLElement,
  buttonRow: HTMLDivElement,
  position: QuickMuteBlockPosition,
): void {
  if (position === "right") {
    const target = nameContainer.parentElement?.parentElement
      ?.nextElementSibling;
    const targetColumn = target?.firstElementChild;
    if (targetColumn?.firstElementChild) {
      targetColumn.firstElementChild.prepend(buttonRow);
      return;
    }
  }

  const direction = globalThis
    .getComputedStyle(nameContainer)
    .getPropertyValue("flex-direction");

  const firstChild = nameContainer.firstElementChild;
  if (direction === "column" && firstChild) {
    firstChild.append(buttonRow);
  } else {
    nameContainer.append(buttonRow);
  }
}

type ActionButtonConfig = {
  title: string;
  path: string;
  onClick: () => void;
};

function buildActionButton(config: ActionButtonConfig): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.title = config.title;
  button.style.cursor = "pointer";
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.width = `${BUTTON_SIZE}px`;
  button.style.height = `${BUTTON_SIZE}px`;
  button.style.padding = `${BUTTON_PADDING}px`;
  button.style.background = "none";
  button.style.border = "none";
  button.style.borderRadius = "50%";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", `${BUTTON_SIZE}px`);
  svg.setAttribute("height", `${BUTTON_SIZE}px`);

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", config.path);
  path.setAttribute("fill", ICON_COLOR);
  svg.append(path);

  button.append(svg);

  button.addEventListener("mouseenter", () => {
    button.style.backgroundColor = "rgba(255, 0, 17, 0.2)";
    button.style.color = "rgb(244, 33, 46)";
  });
  button.addEventListener("mouseleave", () => {
    button.style.backgroundColor = "unset";
    button.style.color = "inherit";
  });

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    config.onClick();
  });

  return button;
}

async function handleMute(tweet: HTMLElement): Promise<void> {
  const menuButton = tweet.querySelector<HTMLElement>(
    '[aria-haspopup="menu"][data-testid="caret"]',
  );
  if (!menuButton) return;

  menuButton.click();
  await selectMenuItemByPath(MUTE_PATH);
}

async function handleBlock(tweet: HTMLElement): Promise<void> {
  const menuButton = tweet.querySelector<HTMLElement>(
    '[aria-haspopup="menu"][data-testid="caret"]',
  );
  if (!menuButton) return;

  menuButton.click();
  await selectMenuItemByPath(BLOCK_PATH);

  await confirmBlock();
  closePremiumModal();
}

async function handleNotInterested(tweet: HTMLElement): Promise<void> {
  const menuButton = tweet.querySelector<HTMLElement>(
    '[aria-haspopup="menu"][data-testid="caret"]',
  );
  if (!menuButton) return;

  menuButton.click();
  await selectMenuItemByPath(NOT_INTERESTED_IN_POST_PATH);
}

async function selectMenuItemByPath(targetPath: string): Promise<void> {
  await wait(MENU_DELAY_MS);
  const items = document.querySelectorAll<HTMLElement>('div[role="menuitem"]');

  for (const item of items) {
    const path = item.querySelector("path");
    if (path?.getAttribute("d") === targetPath) {
      item.click();
      break;
    }
  }
}

async function confirmBlock(): Promise<void> {
  await wait(MENU_DELAY_MS);
  const confirmButton = document.querySelector<HTMLButtonElement>(
    '[data-testid="confirmationSheetConfirm"]',
  );
  confirmButton?.click();
}

function closePremiumModal(): void {
  setTimeout(() => {
    const closeButton = document.querySelector<HTMLButtonElement>(
      'button[data-testid="app-bar-close"]',
    );
    closeButton?.click();
  }, PROMO_CLOSE_DELAY_MS);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
