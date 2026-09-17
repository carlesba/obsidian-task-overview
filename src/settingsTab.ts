import { App, PluginSettingTab, Setting } from "obsidian";
import type TaskOverviewPlugin from "./main";

export class TaskOverviewSettingTab extends PluginSettingTab {
	private plugin: TaskOverviewPlugin;

	constructor(app: App, plugin: TaskOverviewPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Group tasks under their headings")
			.setDesc("Show each task beneath the heading it sits under instead of in one flat list.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showHeadings).onChange((value) => {
					this.plugin.settings.showHeadings = value;
					void this.plugin.saveSettings();
				}),
			);
	}
}
