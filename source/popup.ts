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

type ToggleOptions = {
  disabled?: boolean;
};

function buildToggle(
  option: Option,
  settings: Settings,
  opts: ToggleOptions = {},
): {
  item: HTMLLIElement;
  checkbox: HTMLInputElement;
} {
  const toggleId = `toggle-${option.id}`;

  const root = document.getElementById("root");
  if (!root) throw new Error("Popup root missing");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = toggleId;
  checkbox.checked = Boolean(settings[option.id]);
  checkbox.addEventListener("change", () => {
    setSettings({ [option.id]: checkbox.checked });
  });

  const label = document.createElement("label");
  label.htmlFor = toggleId;
  const labelText = document.createTextNode(option.label);

  label.append(checkbox, labelText);
  const item = document.createElement("li");
  if (opts.disabled) {
    item.classList.add("is-disabled");
    checkbox.disabled = true;
  }
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

  const quickActionsToggleId = "toggle-quick-actions";
  const quickActionsPositionId = "select-quick-actions-position";

  const quickActionsToggle = document.createElement("input");
  quickActionsToggle.type = "checkbox";
  quickActionsToggle.id = quickActionsToggleId;
  quickActionsToggle.checked = settings.quickActionsEnabled;
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

  const quickActionsPosition = document.createElement("select");
  quickActionsPosition.id = quickActionsPositionId;

  const positions: QuickActionPosition[] = ["left", "right"];
  for (const position of positions) {
    const option = document.createElement("option");
    option.value = position;
    option.textContent = `Place on ${position}`;
    if (position === settings.quickActionsPosition) option.selected = true;
    quickActionsPosition.append(option);
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
    document.createTextNode("Button position"),
    quickActionsPosition,
  );
  quickActionsPositionItem.append(quickActionsPositionLabel);

  list.append(quickActionsToggleItem, quickActionsPositionItem);

  const appendOptionNode = (
    option: Option,
    parentList: HTMLUListElement,
  ): HTMLInputElement => {
    const { item, checkbox } = buildToggle(option, settings);
    inputs.set(option.id, checkbox);
    parentList.append(item);

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
      item.append(childList);
      childControls.set(option.id, { childCheckboxes, childList });
    }

    return checkbox;
  };

  for (const option of optionHierarchy as readonly Option[]) {
    appendOptionNode(option, list);
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
