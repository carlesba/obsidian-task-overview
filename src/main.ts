import { Plugin } from "obsidian";
import { TaskFilter } from "./tasks";
import { TASK_OVERVIEW_VIEW, TaskOverviewView } from "./view";

interface TaskOverviewSettings {
	filter: TaskFilter;
}

const DEFAULT_SETTINGS: TaskOverviewSettings = { filter: "open" };

export default class TaskOverviewPlugin extends Plugin {
	settings: TaskOverviewSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		this.registerView(TASK_OVERVIEW_VIEW, (leaf) => new TaskOverviewView(leaf, this));

		this.addRibbonIcon("check-square", "Task overview", () => void this.revealPanel());
		this.addCommand({
			id: "open-panel",
			name: "Open task overview panel",
			callback: () => void this.revealPanel(),
		});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async revealPanel(): Promise<void> {
		const { workspace } = this.app;
		const open = workspace.getLeavesOfType(TASK_OVERVIEW_VIEW);
		if (open.length) {
			workspace.revealLeaf(open[0]);
			return;
		}

		const leaf = workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: TASK_OVERVIEW_VIEW, active: true });
		workspace.revealLeaf(leaf);
	}
}
