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
} from "./options.ts";

const affiliatedOrgsInputId = "input-hide-affiliated-org-tweets-orgs";
const quickActionsToggleId = "toggle-quick-actions";
const quickActionsPositionId = "select-quick-actions-position";
const leftSidebarOptionIds: Option["id"][] = [
  "hideNavigationLabels",
  "centerNavigation",
  "movePostButtonToCorner",
];
const quickActionPositions: QuickActionPosition[] = ["left", "right"];

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
  childControls: Map<
    Option["id"],
    { childCheckboxes: HTMLInputElement[]; childList: HTMLUListElement }
  >;
} {
  const root = document.getElementById("root");
  if (!root) throw new Error("Popup root missing");
  root.textContent = "";

  const list = document.createElement("ul");
  const inputs = new Map<Option["id"], HTMLInputElement>();
  const childControls = new Map<
    Option["id"],
    { childCheckboxes: HTMLInputElement[]; childList: HTMLUListElement }
  >();

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

      const setDisabled = (disabled: boolean): void => {
        for (const childCheckbox of childCheckboxes) {
          childCheckbox.disabled = disabled;
        }
        childList.classList.toggle("is-disabled", disabled);
      };

      setDisabled(checkbox.checked);
      checkbox.addEventListener("change", () => setDisabled(checkbox.checked));

      if (option.id === "hideRightSidebar") {
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.append(document.createTextNode("Right sidebar"));
        details.append(summary);

        const container = document.createElement("div");
        while (item.firstChild) {
          container.append(item.firstChild);
        }
        container.append(childList);

        details.append(container);
        item.append(details);
      } else {
        item.append(childList);
      }

      childControls.set(option.id, { childCheckboxes, childList });
    }

    return checkbox;
  };

  for (const option of optionHierarchy as readonly Option[]) {
    appendOptionNode(option, list);
  }

  const leftItems: HTMLLIElement[] = [];
  for (const optionId of leftSidebarOptionIds) {
    const element = list.querySelector(
      `li[data-option-id="${optionId}"]`,
    ) as HTMLLIElement | null;
    if (element) {
      leftItems.push(element);
    }
  }

  if (leftItems.length) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.append(document.createTextNode("Left sidebar"));
    details.append(summary);

    const container = document.createElement("div");
    for (const item of leftItems) {
      container.append(item);
    }
    details.append(container);

    const wrapper = document.createElement("li");
    wrapper.append(details);

    const firstItem = list.querySelector("li");
    if (firstItem) {
      list.insertBefore(wrapper, firstItem);
    } else {
      list.append(wrapper);
    }
  }

  const quickActionsToggle = document.createElement("input");
  quickActionsToggle.type = "checkbox";
  quickActionsToggle.id = quickActionsToggleId;
  quickActionsToggle.checked = settings.quickActionsEnabled;

  const quickActionsPosition = document.createElement("select");
  quickActionsPosition.id = quickActionsPositionId;

  quickActionsToggle.addEventListener("change", () => {
    setSettings({ quickActionsEnabled: quickActionsToggle.checked });
    quickActionsPosition.disabled = !quickActionsToggle.checked;
  });

  const quickActionsLabel = document.createElement("label");
  quickActionsLabel.htmlFor = quickActionsToggleId;
  quickActionsLabel.append(
    quickActionsToggle,
    document.createTextNode(" Enable quick action buttons"),
  );

  const quickActionsToggleItem = document.createElement("li");
  quickActionsToggleItem.append(quickActionsLabel);

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

  const nonSidebarItem = Array.from(list.children).find((element) => {
    const li = element as HTMLLIElement;
    const id = li.dataset.optionId as Option["id"] | undefined;
    if (!id) return false;
    if (id === "hideRightSidebar") return false;
    if (leftSidebarOptionIds.includes(id)) return false;
    return true;
  }) as HTMLLIElement | undefined;

  if (nonSidebarItem) {
    list.insertBefore(quickActionsToggleItem, nonSidebarItem);
    list.insertBefore(quickActionsPositionItem, nonSidebarItem);
  } else {
    list.append(quickActionsToggleItem, quickActionsPositionItem);
  }

  root.append(list);
  return {
    inputs,
    quickActionsToggle,
    quickActionsPosition,
    childControls,
  };
}

function watchStorageUpdates(
  inputs: Map<Option["id"], HTMLInputElement>,
  quickActionsToggle: HTMLInputElement,
  quickActionsPosition: HTMLSelectElement,
  childControls: Map<
    Option["id"],
    { childCheckboxes: HTMLInputElement[]; childList: HTMLUListElement }
  >,
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
      const disabled = parent.checked;
      for (const childCheckbox of controls.childCheckboxes) {
        childCheckbox.disabled = disabled;
      }
      controls.childList.classList.toggle("is-disabled", disabled);
    }

    const quickActionsEnabled = changes.quickActionsEnabled;
    if (quickActionsEnabled) {
      quickActionsToggle.checked = Boolean(
        quickActionsEnabled.newValue ?? defaultSettings.quickActionsEnabled,
      );
      quickActionsPosition.disabled = !quickActionsToggle.checked;
    }

    const quickActionsPositionChange = changes.quickActionsPosition;
    if (quickActionsPositionChange) {
      const value = (quickActionsPositionChange.newValue ??
        defaultSettings.quickActionsPosition) as QuickActionPosition;
      quickActionsPosition.value = value;
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
    childControls,
  } = buildToggles(settings);
  watchStorageUpdates(
    inputs,
    quickActionsToggle,
    quickActionsPosition,
    childControls,
  );
}

main();
