import { Plugin } from "obsidian";
import { TaskOverviewSettings, defaultSettings, migrateSettings } from "./settings";
import { TaskOverviewSettingTab } from "./settingsTab";
import { TASK_OVERVIEW_VIEW, TaskOverviewView } from "./view";

export default class TaskOverviewPlugin extends Plugin {
	settings: TaskOverviewSettings = defaultSettings();

	async onload(): Promise<void> {
		this.settings = migrateSettings(await this.loadData());

		this.registerView(TASK_OVERVIEW_VIEW, (leaf) => new TaskOverviewView(leaf, this));
		this.addSettingTab(new TaskOverviewSettingTab(this.app, this));

		this.addRibbonIcon("check-square", "Task overview", () => void this.revealPanel());
		this.addCommand({
			id: "open-panel",
			name: "Open task overview panel",
			callback: () => void this.revealPanel(),
		});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		for (const view of this.taskOverviewViews()) view.render();
	}

	private async revealPanel(): Promise<void> {
		const { workspace } = this.app;
		const open = workspace.getLeavesOfType(TASK_OVERVIEW_VIEW);
		if (open.length) {
			await workspace.revealLeaf(open[0]);
			return;
		}

		const leaf = workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: TASK_OVERVIEW_VIEW, active: true });
		await workspace.revealLeaf(leaf);
	}

	private taskOverviewViews(): TaskOverviewView[] {
		return this.app.workspace
			.getLeavesOfType(TASK_OVERVIEW_VIEW)
			.map((leaf) => leaf.view)
			.filter((view): view is TaskOverviewView => view instanceof TaskOverviewView);
	}
}
