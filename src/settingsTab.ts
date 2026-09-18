import { App, PluginSettingTab, Setting, SettingDefinitionItem } from "obsidian";
import type TaskOverviewPlugin from "./main";

const HEADINGS_SETTING = {
	key: "showHeadings",
	name: "Group tasks under their headings",
	desc: "Show each task beneath the heading it sits under instead of in one flat list.",
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
		];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key !== HEADINGS_SETTING.key) return;
		this.plugin.settings.showHeadings = value === true;
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
	}
}
