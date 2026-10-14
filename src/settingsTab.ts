import { App, PluginSettingTab, Setting, SettingDefinitionItem } from "obsidian";
import type TaskOverviewPlugin from "./main";
import { ClosingStatuses, readClosingStatuses } from "./settings";
import { closingSymbolsError } from "./statuses";

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
					validate: (typed) => closingSymbolsError(typed),
				},
			},
		];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key === HEADINGS_SETTING.key) {
			this.plugin.settings.showHeadings = value === true;
		} else if (key === CLOSING_STATUSES_SETTING.key) {
			this.plugin.settings.closingStatuses = readClosingStatuses(value);
			this.refreshDomState();
		} else if (key === CLOSING_SYMBOLS_SETTING.key) {
			this.plugin.settings.closingSymbols = typeof value === "string" ? value : "";
		} else {
			return;
		}
		await this.plugin.saveSettings();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName(HEADINGS_SETTING.name)
			.setDesc(HEADINGS_SETTING.desc)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showHeadings).onChange((value) => {
					this.plugin.settings.showHeadings = value;
					void this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName(CLOSING_STATUSES_SETTING.name)
			.setDesc(CLOSING_STATUSES_SETTING.desc)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(CLOSING_STATUSES_SETTING.options)
					.setValue(this.plugin.settings.closingStatuses)
					.onChange((value) => {
						this.plugin.settings.closingStatuses = readClosingStatuses(value);
						void this.plugin.saveSettings();
						this.display();
					}),
			);

		if (this.plugin.settings.closingStatuses !== "listed") return;

		const symbolsSetting = new Setting(containerEl)
			.setName(CLOSING_SYMBOLS_SETTING.name)
			.setDesc(CLOSING_SYMBOLS_SETTING.desc);
		symbolsSetting.addText((text) =>
			text
				.setPlaceholder(CLOSING_SYMBOLS_SETTING.placeholder)
				.setValue(this.plugin.settings.closingSymbols)
				.onChange((value) => {
					const error = closingSymbolsError(value);
					symbolsSetting.setDesc(error ?? CLOSING_SYMBOLS_SETTING.desc);
					if (error) return;
					this.plugin.settings.closingSymbols = value;
					void this.plugin.saveSettings();
				}),
		);
	}
}
