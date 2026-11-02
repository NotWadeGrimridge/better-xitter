import {
  getSettings,
  OPTION_HIERARCHY,
  QUICK_ACTION_POSITIONS,
  setSettings,
} from "@/options.ts";
import type { Option, OptionId, ToggleId } from "@/options.ts";

const settings = await getSettings();
const optionsById = new Map<OptionId, Option>(
  OPTION_HIERARCHY.map((option) => [option.id, option]),
);

function createToggle(
  id: ToggleId,
  labelText: string,
): { item: HTMLLIElement; input: HTMLInputElement } {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.role = "switch";
  input.checked = settings[id];
  input.addEventListener("change", () => setSettings({ [id]: input.checked }));

  const text = document.createElement("span");
  text.textContent = labelText;

  const label = document.createElement("label");
  label.className = "row";
  label.append(text, input);

  const item = document.createElement("li");
  item.append(label);

  return { item, input };
}

function createChildList(
  parent: HTMLInputElement,
  ...children: HTMLElement[]
): HTMLUListElement {
  const list = document.createElement("ul");
  list.className = "child-list";
  list.append(...children);
  list.hidden = !parent.checked;

  parent.addEventListener("change", () => {
    list.hidden = !parent.checked;
  });

  return list;
}

function createOrgHandlesField(): HTMLLIElement {
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "@Kalshi, @Polymarket";
  input.ariaLabel = "Organization handles";
  input.value = settings.hideAffiliatedOrgTweetsOrgs;
  input.addEventListener("input", () => {
    setSettings({ hideAffiliatedOrgTweetsOrgs: input.value });
  });

  const item = document.createElement("li");
  item.className = "field";
  item.append(input);

  return item;
}

function createOptionItem(option: Option): HTMLLIElement {
  const { item, input } = createToggle(option.id, option.label);

  const children = option.children?.map(createOptionItem) ?? [];
  if (option.id === "hideAffiliatedOrgTweets") {
    children.unshift(createOrgHandlesField());
  }
  if (children.length > 0) item.append(createChildList(input, ...children));

  return item;
}

function createOptionItems(ids: OptionId[]): HTMLLIElement[] {
  return ids.flatMap((id) => {
    const option = optionsById.get(id);
    return option ? [createOptionItem(option)] : [];
  });
}

function createPositionPicker(): HTMLLIElement {
  const picker = document.createElement("div");
  picker.className = "segmented";
  picker.role = "radiogroup";
  picker.ariaLabel = "Button position";

  for (const position of QUICK_ACTION_POSITIONS) {
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "quickActionsPosition";
    input.checked = position === settings.quickActionsPosition;
    input.addEventListener("change", () => {
      setSettings({ quickActionsPosition: position });
    });

    const label = document.createElement("label");
    label.append(input, position === "left" ? "Left" : "Right");
    picker.append(label);
  }

  const text = document.createElement("span");
  text.textContent = "Position";

  const row = document.createElement("div");
  row.className = "row";
  row.append(text, picker);

  const item = document.createElement("li");
  item.append(row);

  return item;
}

function createQuickActionsItem(): HTMLLIElement {
  const { item, input } = createToggle(
    "quickActionsEnabled",
    "Show quick action buttons",
  );

  item.append(
    createChildList(
      input,
      createPositionPicker(),
      createToggle("quickActionsNotInterestedEnabled", "Not interested").item,
      createToggle("quickActionsMuteEnabled", "Mute").item,
      createToggle("quickActionsBlockEnabled", "Block").item,
    ),
  );

  return item;
}

function createSection(
  title: string,
  items: HTMLElement[],
  hint?: string,
): HTMLDetailsElement {
  const count = document.createElement("span");
  count.className = "count";

  const summary = document.createElement("summary");
  summary.append(title, count);

  const list = document.createElement("ul");
  list.className = "rows";
  list.append(...items);

  const details = document.createElement("details");
  details.className = "section";
  details.name = "sections";
  details.append(summary, list);

  if (hint) {
    const hintText = document.createElement("p");
    hintText.className = "hint";
    hintText.textContent = hint;
    details.append(hintText);
  }

  function updateCount(): void {
    const switches = [
      ...list.querySelectorAll<HTMLInputElement>('input[role="switch"]'),
    ].filter((toggle) => !toggle.closest("[hidden]"));
    const enabledCount = switches.filter((toggle) => toggle.checked).length;
    count.textContent = `${enabledCount}/${switches.length}`;
  }

  updateCount();
  list.addEventListener("change", updateCount);

  return details;
}

document.querySelector("#version")?.append(
  `v${chrome.runtime.getManifest().version}`,
);

document.querySelector("#root")?.replaceChildren(
  createSection(
    "Timeline",
    createOptionItems([
      "hideNewPostsBanner",
      "hideTimelineSideBorders",
      "hidePromotedPosts",
      "hideGrokButton",
      "hideGrokDrawer",
      "hideChatDrawer",
    ]),
  ),
  createSection(
    "Right sidebar",
    createOptionItems([
      "hideOffers",
      "hideTrending",
      "hideLiveOnX",
      "hideNews",
      "hideWhoToFollow",
      "hideFooter",
    ]),
  ),
  createSection(
    "Left sidebar",
    createOptionItems([
      "hideNavigationLabels",
      "centerNavigation",
      "movePostButtonToCorner",
    ]),
  ),
  createSection("Quick actions", [createQuickActionsItem()]),
  createSection(
    "Tweet details",
    createOptionItems(["showTweetClientInfo", "showTweetLocationInfo"]),
    "Reload x.com to apply changes here.",
  ),
  createSection(
    "Affiliates",
    createOptionItems(["hideAffiliatedOrgTweets"]),
    "Hides For You tweets from people affiliated with the orgs you list.",
  ),
);
