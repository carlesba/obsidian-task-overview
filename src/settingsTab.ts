import { App, PluginSettingTab, Setting, SettingDefinitionItem } from "obsidian";
import type TaskOverviewPlugin from "./main";
import {
	ClosingStatuses,
	HiddenStatuses,
	TaskOverviewSettings,
	readClosingStatuses,
	readHiddenStatuses,
} from "./settings";
import { symbolListError } from "./statuses";

const HEADINGS_SETTING = {
	key: "showHeadings",
	name: "Group tasks under their headings",
	desc: "Show each task beneath the heading it sits under instead of in one flat list.",
} as const;

const CLOSING_STATUSES_SETTING = {
	key: "closingStatuses",
	name: "Statuses that close a task",
	desc: "Closed tasks show as checked and appear under the closed filter instead of the open one.",
	options: {
		"done-and-cancelled": "Done [x] and cancelled [-]",
		"any-mark": "Any character inside the brackets",
		listed: "Only the characters I list",
		"tasks-plugin": "Follow the Tasks plugin's statuses",
	} satisfies Record<ClosingStatuses, string>,
} as const;

const CLOSING_SYMBOLS_SETTING = {
	key: "closingSymbols",
	name: "Characters that close a task",
	desc: "Comma-separated, for example: x, X, -, >",
	placeholder: "x, X, -",
} as const;

const NOT_TASKS_HEADING = "List items that are not tasks";

const HIDDEN_STATUSES_SETTING = {
	key: "hiddenStatuses",
	name: "Statuses to leave out of the panel",
	desc: "Checkboxes with these marks are list items, such as [i] for information, so the panel neither lists nor counts them.",
	options: {
		none: "None",
		"tasks-plugin": "Follow the Tasks plugin's non-task statuses",
		listed: "Only the characters I list",
	} satisfies Record<HiddenStatuses, string>,
} as const;

const HIDDEN_SYMBOLS_SETTING = {
	key: "hiddenSymbols",
	name: "Characters that are not tasks",
	desc: "Comma-separated, for example: i, ?",
	placeholder: "i",
} as const;

type SymbolsKey = typeof CLOSING_SYMBOLS_SETTING.key | typeof HIDDEN_SYMBOLS_SETTING.key;

export class TaskOverviewSettingTab extends PluginSettingTab {
	private plugin: TaskOverviewPlugin;

	constructor(app: App, plugin: TaskOverviewPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: HEADINGS_SETTING.name,
				desc: HEADINGS_SETTING.desc,
				control: { type: "toggle", key: HEADINGS_SETTING.key },
			},
			{
				name: CLOSING_STATUSES_SETTING.name,
				desc: CLOSING_STATUSES_SETTING.desc,
				control: {
					type: "dropdown",
					key: CLOSING_STATUSES_SETTING.key,
					options: CLOSING_STATUSES_SETTING.options,
				},
			},
			{
				name: CLOSING_SYMBOLS_SETTING.name,
				desc: CLOSING_SYMBOLS_SETTING.desc,
				visible: () => this.plugin.settings.closingStatuses === "listed",
				control: {
					type: "text",
					key: CLOSING_SYMBOLS_SETTING.key,
					placeholder: CLOSING_SYMBOLS_SETTING.placeholder,
					validate: (typed) => symbolListError(typed),
				},
			},
			{
				type: "group",
				heading: NOT_TASKS_HEADING,
				items: [
					{
						name: HIDDEN_STATUSES_SETTING.name,
						desc: HIDDEN_STATUSES_SETTING.desc,
						control: {
							type: "dropdown",
							key: HIDDEN_STATUSES_SETTING.key,
							options: HIDDEN_STATUSES_SETTING.options,
						},
					},
					{
						name: HIDDEN_SYMBOLS_SETTING.name,
						desc: HIDDEN_SYMBOLS_SETTING.desc,
						visible: () => this.plugin.settings.hiddenStatuses === "listed",
						control: {
							type: "text",
							key: HIDDEN_SYMBOLS_SETTING.key,
							placeholder: HIDDEN_SYMBOLS_SETTING.placeholder,
							validate: (typed) => symbolListError(typed),
						},
					},
				],
			},
		];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const { settings } = this.plugin;
		if (key === HEADINGS_SETTING.key) {
			settings.showHeadings = value === true;
		} else if (key === CLOSING_STATUSES_SETTING.key) {
			settings.closingStatuses = readClosingStatuses(value);
			this.refreshDomState();
		} else if (key === HIDDEN_STATUSES_SETTING.key) {
			settings.hiddenStatuses = readHiddenStatuses(value);
			this.refreshDomState();
		} else if (key === CLOSING_SYMBOLS_SETTING.key || key === HIDDEN_SYMBOLS_SETTING.key) {
			settings[key] = typeof value === "string" ? value : "";
		} else {
			return;
		}
		await this.plugin.saveSettings();
	}

	display(): void {
		const { containerEl } = this;
		const { settings } = this.plugin;
		containerEl.empty();

		new Setting(containerEl)
			.setName(HEADINGS_SETTING.name)
			.setDesc(HEADINGS_SETTING.desc)
			.addToggle((toggle) =>
				toggle.setValue(settings.showHeadings).onChange((value) => {
					settings.showHeadings = value;
					void this.plugin.saveSettings();
				}),
			);

		this.addModeDropdown(CLOSING_STATUSES_SETTING, settings.closingStatuses, (value) => {
			settings.closingStatuses = readClosingStatuses(value);
		});
		if (settings.closingStatuses === "listed") this.addSymbolsField(CLOSING_SYMBOLS_SETTING);

		new Setting(containerEl).setName(NOT_TASKS_HEADING).setHeading();

		this.addModeDropdown(HIDDEN_STATUSES_SETTING, settings.hiddenStatuses, (value) => {
			settings.hiddenStatuses = readHiddenStatuses(value);
		});
		if (settings.hiddenStatuses === "listed") this.addSymbolsField(HIDDEN_SYMBOLS_SETTING);
	}

	private addModeDropdown(
		definition: { name: string; desc: string; options: Record<string, string> },
		selected: string,
		select: (value: string) => void,
	): void {
		new Setting(this.containerEl)
			.setName(definition.name)
			.setDesc(definition.desc)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(definition.options)
					.setValue(selected)
					.onChange((value) => {
						select(value);
						void this.plugin.saveSettings();
						this.display();
					}),
			);
	}

	private addSymbolsField(definition: { key: SymbolsKey; name: string; desc: string; placeholder: string }): void {
		const settings: TaskOverviewSettings = this.plugin.settings;
		const field = new Setting(this.containerEl).setName(definition.name).setDesc(definition.desc);
		field.addText((text) =>
			text
				.setPlaceholder(definition.placeholder)
				.setValue(settings[definition.key])
				.onChange((value) => {
					const error = symbolListError(value);
					field.setDesc(error ?? definition.desc);
					if (error) return;
					settings[definition.key] = value;
					void this.plugin.saveSettings();
				}),
		);
	}
}
