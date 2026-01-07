/// <reference lib="dom" />
/// <reference lib="esnext" />

import {
  defaultSettings,
  getSettings,
  type Option,
  optionHierarchy,
  options,
  type QuickActionPosition,
  setSettings,
  type Settings,
} from "@/options.ts";

const affiliatedOrgsInputId = "input-hide-affiliated-org-tweets-orgs";
const quickActionsToggleId = "toggle-quick-actions";
const quickActionsPositionId = "select-quick-actions-position";
const quickActionsMuteId = "toggle-quick-actions-mute";
const quickActionsBlockId = "toggle-quick-actions-block";
const quickActionsNotInterestedId = "toggle-quick-actions-not-interested";
const rightSidebarOptionIds: Option["id"][] = [
  "hideOffers",
  "hideTrending",
  "hideLiveOnX",
  "hideNews",
  "hideWhoToFollow",
  "hideFooter",
];
const leftSidebarOptionIds: Option["id"][] = [
  "hideNavigationLabels",
  "centerNavigation",
  "movePostButtonToCorner",
];
const declutterOptionIds: Option["id"][] = [
  "hideNewPostsBanner",
  "hideTimelineSideBorders",
  "hidePromotedPosts",
  "hideGrokButton",
  "hideGrokDrawer",
  "hideChatDrawer",
];
const featureOptionIds: Option["id"][] = [
  "showTweetClientInfo",
  "showTweetLocationInfo",
  "hideAffiliatedOrgTweets",
];
const quickActionPositions: QuickActionPosition[] = ["left", "right"];

type ChildControls = {
  childCheckboxes: HTMLInputElement[];
  childList: HTMLUListElement;
};

function setChildControls(
  parentChecked: boolean,
  controls: ChildControls,
): void {
  const disabled = !parentChecked;
  const hidden = !parentChecked;

  for (const childCheckbox of controls.childCheckboxes) {
    childCheckbox.disabled = disabled;
  }
  controls.childList.classList.toggle("is-disabled", disabled);
  controls.childList.hidden = hidden;
}

function setQuickActionsChildrenEnabled(
  enabled: boolean,
  positionSelect: HTMLSelectElement,
  childList: HTMLUListElement,
  children: HTMLInputElement[],
): void {
  positionSelect.disabled = !enabled;
  for (const input of children) {
    input.disabled = !enabled;
  }
  childList.classList.toggle("is-disabled", !enabled);
  childList.hidden = !enabled;
}

function buildToggle(
  option: Option,
  settings: Settings,
): {
  item: HTMLLIElement;
  checkbox: HTMLInputElement;
} {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = `toggle-${option.id}`;
  checkbox.checked = Boolean(settings[option.id]);
  checkbox.addEventListener("change", () => {
    setSettings({ [option.id]: checkbox.checked });
  });

  const label = document.createElement("label");
  label.htmlFor = checkbox.id;
  const labelText = document.createTextNode(option.label);

  label.append(checkbox, labelText);
  const item = document.createElement("li");
  item.dataset.optionId = option.id;
  item.append(label);
  return { item, checkbox };
}

function buildToggles(settings: Settings): {
  inputs: Map<Option["id"], HTMLInputElement>;
  quickActionsToggle: HTMLInputElement;
  quickActionsPosition: HTMLSelectElement;
  quickActionsChildList: HTMLUListElement;
  quickActionsChildren: HTMLInputElement[];
  childControls: Map<Option["id"], ChildControls>;
} {
  const root = document.getElementById("root");
  if (!root) throw new Error("Popup root missing");
  root.textContent = "";

  const list = document.createElement("ul");
  const inputs = new Map<Option["id"], HTMLInputElement>();
  const childControls = new Map<Option["id"], ChildControls>();

  const appendOptionNode = (
    option: Option,
    parentList: HTMLUListElement,
  ): HTMLInputElement => {
    const { item, checkbox } = buildToggle(option, settings);
    inputs.set(option.id, checkbox);
    parentList.append(item);

    if (option.id === "hideAffiliatedOrgTweets") {
      const orgsInput = document.createElement("input");
      orgsInput.id = affiliatedOrgsInputId;
      orgsInput.type = "text";
      orgsInput.placeholder = "@Kalshi, @Polymarket";
      orgsInput.value = settings.hideAffiliatedOrgTweetsOrgs;

      orgsInput.addEventListener("input", () => {
        setSettings({ hideAffiliatedOrgTweetsOrgs: orgsInput.value });
      });

      const orgsContainer = document.createElement("div");
      orgsContainer.append(orgsInput);
      orgsContainer.hidden = !checkbox.checked;
      item.append(orgsContainer);

      const label = item.querySelector("label");
      if (label) {
        const help = document.createElement("span");
        help.className = "help-icon";
        help.textContent = "?";
        help.title =
          "Hide tweets from users affiliated to orgs that you don't like (only on For You page).";
        label.append(help);
      }

      checkbox.addEventListener("change", () => {
        orgsContainer.hidden = !checkbox.checked;
      });
    }

    if (option.children?.length) {
      const childList = document.createElement("ul");
      childList.classList.add("child-list");
      const childCheckboxes: HTMLInputElement[] = [];

      for (const child of option.children) {
        childCheckboxes.push(appendOptionNode(child as Option, childList));
      }

      const controls: ChildControls = { childCheckboxes, childList };

      setChildControls(checkbox.checked, controls);
      checkbox.addEventListener("change", () => {
        setChildControls(checkbox.checked, controls);
      });

      item.append(childList);

      childControls.set(option.id, controls);
    }

    return checkbox;
  };

  for (const option of optionHierarchy as readonly Option[]) {
    appendOptionNode(option, list);
  }

  const quickActionsToggle = document.createElement("input");
  quickActionsToggle.type = "checkbox";
  quickActionsToggle.id = quickActionsToggleId;
  quickActionsToggle.checked = settings.quickActionsEnabled;

  const quickActionsPosition = document.createElement("select");
  quickActionsPosition.id = quickActionsPositionId;

  const quickActionsLabel = document.createElement("label");
  quickActionsLabel.htmlFor = quickActionsToggleId;
  quickActionsLabel.append(
    quickActionsToggle,
    document.createTextNode(" Enable quick action buttons"),
  );

  for (const position of quickActionPositions) {
    const optionElement = document.createElement("option");
    optionElement.value = position;
    optionElement.textContent = position === "left" ? "Left" : "Right";
    if (position === settings.quickActionsPosition) {
      optionElement.selected = true;
    }
    quickActionsPosition.append(optionElement);
  }

  quickActionsPosition.disabled = !settings.quickActionsEnabled;
  quickActionsPosition.addEventListener("change", () => {
    const value = quickActionsPosition.value as QuickActionPosition;
    setSettings({ quickActionsPosition: value });
  });

  const quickActionsPositionItem = document.createElement("li");
  const quickActionsPositionLabel = document.createElement("label");
  quickActionsPositionLabel.htmlFor = quickActionsPositionId;
  quickActionsPositionLabel.append(
    document.createTextNode("Position:"),
    quickActionsPosition,
  );
  quickActionsPositionItem.append(quickActionsPositionLabel);

  const quickActionsChildList = document.createElement("ul");
  quickActionsChildList.classList.add("child-list");

  const quickActionsChildren: HTMLInputElement[] = [];

  const quickActionsMute = document.createElement("input");
  quickActionsMute.type = "checkbox";
  quickActionsMute.id = quickActionsMuteId;
  quickActionsMute.checked = Boolean(settings.quickActionsMuteEnabled);
  quickActionsMute.addEventListener("change", () => {
    setSettings({ quickActionsMuteEnabled: quickActionsMute.checked });
  });
  const quickActionsMuteLabel = document.createElement("label");
  quickActionsMuteLabel.htmlFor = quickActionsMuteId;
  quickActionsMuteLabel.append(
    quickActionsMute,
    document.createTextNode(" Mute"),
  );
  const quickActionsMuteItem = document.createElement("li");
  quickActionsMuteItem.append(quickActionsMuteLabel);
  quickActionsChildList.append(quickActionsMuteItem);
  quickActionsChildren.push(quickActionsMute);

  const quickActionsBlock = document.createElement("input");
  quickActionsBlock.type = "checkbox";
  quickActionsBlock.id = quickActionsBlockId;
  quickActionsBlock.checked = Boolean(settings.quickActionsBlockEnabled);
  quickActionsBlock.addEventListener("change", () => {
    setSettings({ quickActionsBlockEnabled: quickActionsBlock.checked });
  });
  const quickActionsBlockLabel = document.createElement("label");
  quickActionsBlockLabel.htmlFor = quickActionsBlockId;
  quickActionsBlockLabel.append(
    quickActionsBlock,
    document.createTextNode(" Block"),
  );
  const quickActionsBlockItem = document.createElement("li");
  quickActionsBlockItem.append(quickActionsBlockLabel);
  quickActionsChildList.append(quickActionsBlockItem);
  quickActionsChildren.push(quickActionsBlock);

  const quickActionsNotInterested = document.createElement("input");
  quickActionsNotInterested.type = "checkbox";
  quickActionsNotInterested.id = quickActionsNotInterestedId;
  quickActionsNotInterested.checked = Boolean(
    settings.quickActionsNotInterestedEnabled,
  );
  quickActionsNotInterested.addEventListener("change", () => {
    setSettings({
      quickActionsNotInterestedEnabled: quickActionsNotInterested.checked,
    });
  });
  const quickActionsNotInterestedLabel = document.createElement("label");
  quickActionsNotInterestedLabel.htmlFor = quickActionsNotInterestedId;
  quickActionsNotInterestedLabel.append(
    quickActionsNotInterested,
    document.createTextNode(" Not interested"),
  );
  const quickActionsNotInterestedItem = document.createElement("li");
  quickActionsNotInterestedItem.append(quickActionsNotInterestedLabel);

  quickActionsChildList.append(
    quickActionsPositionItem,
    quickActionsNotInterestedItem,
    quickActionsMuteItem,
    quickActionsBlockItem,
  );
  quickActionsChildren.push(quickActionsNotInterested);
  setQuickActionsChildrenEnabled(
    settings.quickActionsEnabled,
    quickActionsPosition,
    quickActionsChildList,
    quickActionsChildren,
  );

  quickActionsToggle.addEventListener("change", () => {
    const enabled = quickActionsToggle.checked;
    setSettings({ quickActionsEnabled: enabled });
    setQuickActionsChildrenEnabled(
      enabled,
      quickActionsPosition,
      quickActionsChildList,
      quickActionsChildren,
    );
  });

  const quickActionsContainer = document.createElement("div");
  quickActionsContainer.append(quickActionsLabel, quickActionsChildList);

  const quickActionsDetails = document.createElement("details");
  const quickActionsSummary = document.createElement("summary");
  quickActionsSummary.append(document.createTextNode("Quick actions"));
  quickActionsDetails.append(quickActionsSummary, quickActionsContainer);

  const quickActionsWrapper = document.createElement("li");
  quickActionsWrapper.append(quickActionsDetails);

  const sidebarDetails = document.createElement("details");
  const sidebarSummary = document.createElement("summary");
  sidebarSummary.append(document.createTextNode("Sidebar"));
  sidebarDetails.append(sidebarSummary);

  const sidebarContainer = document.createElement("div");
  for (const optionId of rightSidebarOptionIds) {
    const element = list.querySelector(
      `li[data-option-id="${optionId}"]`,
    ) as HTMLLIElement | null;
    if (element) {
      sidebarContainer.append(element);
    }
  }

  const separator = document.createElement("hr");
  sidebarContainer.append(separator);

  let movePostItem: HTMLLIElement | undefined;
  for (const optionId of leftSidebarOptionIds) {
    const element = list.querySelector(
      `li[data-option-id="${optionId}"]`,
    ) as HTMLLIElement | null;
    if (!element) continue;
    if (optionId === "movePostButtonToCorner") {
      movePostItem = element;
    } else {
      sidebarContainer.append(element);
    }
  }

  if (movePostItem) {
    sidebarContainer.append(movePostItem);
  }

  sidebarDetails.append(sidebarContainer);
  const sidebarWrapper = document.createElement("li");
  sidebarWrapper.append(sidebarDetails);

  const declutterDetails = document.createElement("details");
  const declutterSummary = document.createElement("summary");
  declutterSummary.append(document.createTextNode("Declutter"));
  declutterDetails.append(declutterSummary);

  const declutterContainer = document.createElement("div");
  for (const optionId of declutterOptionIds) {
    const item = list.querySelector(
      `li[data-option-id="${optionId}"]`,
    ) as HTMLLIElement | null;
    if (item) {
      declutterContainer.append(item);
    }
  }

  declutterDetails.append(declutterContainer);
  const declutterWrapper = document.createElement("li");
  declutterWrapper.append(declutterDetails);

  const featureItems: HTMLLIElement[] = [];
  for (const optionId of featureOptionIds) {
    const item = list.querySelector(
      `li[data-option-id="${optionId}"]`,
    ) as HTMLLIElement | null;
    if (item) {
      featureItems.push(item);
    }
  }

  while (list.firstChild) {
    list.removeChild(list.firstChild);
  }

  list.append(declutterWrapper, sidebarWrapper, quickActionsWrapper);
  for (const item of featureItems) {
    list.append(item);
  }

  root.append(list);
  return {
    inputs,
    quickActionsToggle,
    quickActionsPosition,
    quickActionsChildList,
    quickActionsChildren,
    childControls,
  };
}

function watchStorageUpdates(
  inputs: Map<Option["id"], HTMLInputElement>,
  quickActionsToggle: HTMLInputElement,
  quickActionsPosition: HTMLSelectElement,
  quickActionsChildList: HTMLUListElement,
  quickActionsChildren: HTMLInputElement[],
  childControls: Map<Option["id"], ChildControls>,
): void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
  ): void => {
    for (const option of options) {
      const change = changes[option.id];
      if (!change) continue;

      const checkbox = inputs.get(option.id);
      if (!checkbox) continue;
      checkbox.checked = Boolean(
        change.newValue ?? defaultSettings[option.id],
      );
    }

    for (const [parentId, controls] of childControls.entries()) {
      const parent = inputs.get(parentId);
      if (!parent) continue;
      setChildControls(parent.checked, controls);
    }

    const quickActionsEnabled = changes.quickActionsEnabled;
    if (quickActionsEnabled) {
      quickActionsToggle.checked = Boolean(
        quickActionsEnabled.newValue ?? defaultSettings.quickActionsEnabled,
      );
      const enabled = quickActionsToggle.checked;
      setQuickActionsChildrenEnabled(
        enabled,
        quickActionsPosition,
        quickActionsChildList,
        quickActionsChildren,
      );
    }

    const quickActionsPositionChange = changes.quickActionsPosition;
    if (quickActionsPositionChange) {
      const value = (quickActionsPositionChange.newValue ??
        defaultSettings.quickActionsPosition) as QuickActionPosition;
      quickActionsPosition.value = value;
    }

    const quickActionsMuteChange = changes.quickActionsMuteEnabled;
    if (quickActionsMuteChange) {
      const input = document.getElementById(
        quickActionsMuteId,
      ) as HTMLInputElement | null;
      if (input) {
        input.checked = Boolean(
          quickActionsMuteChange.newValue ??
            defaultSettings.quickActionsMuteEnabled,
        );
      }
    }

    const quickActionsBlockChange = changes.quickActionsBlockEnabled;
    if (quickActionsBlockChange) {
      const input = document.getElementById(
        quickActionsBlockId,
      ) as HTMLInputElement | null;
      if (input) {
        input.checked = Boolean(
          quickActionsBlockChange.newValue ??
            defaultSettings.quickActionsBlockEnabled,
        );
      }
    }

    const quickActionsNotInterestedChange = changes
      .quickActionsNotInterestedEnabled;
    if (quickActionsNotInterestedChange) {
      const input = document.getElementById(
        quickActionsNotInterestedId,
      ) as HTMLInputElement | null;
      if (input) {
        input.checked = Boolean(
          quickActionsNotInterestedChange.newValue ??
            defaultSettings.quickActionsNotInterestedEnabled,
        );
      }
    }

    const affiliatedOrgsChange = changes.hideAffiliatedOrgTweetsOrgs;
    if (affiliatedOrgsChange) {
      const input = document.getElementById(
        affiliatedOrgsInputId,
      ) as HTMLInputElement | null;
      if (input) {
        input.value = String(
          affiliatedOrgsChange.newValue ??
            defaultSettings.hideAffiliatedOrgTweetsOrgs,
        );
      }
    }
  };

  chrome.storage.onChanged.addListener(listener);
}

async function main(): Promise<void> {
  const settings = await getSettings();
  const {
    inputs,
    quickActionsToggle,
    quickActionsPosition,
    quickActionsChildList,
    quickActionsChildren,
    childControls,
  } = buildToggles(settings);
  watchStorageUpdates(
    inputs,
    quickActionsToggle,
    quickActionsPosition,
    quickActionsChildList,
    quickActionsChildren,
    childControls,
  );
}

main();
