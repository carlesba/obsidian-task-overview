import { Plugin } from "obsidian";
import {
	NotePanelSettings,
	TaskOverviewSettingTab,
	TaskOverviewSettings,
	defaultSettings,
	migrateSettings,
	noteBasename,
} from "./settings";
import { TASK_OVERVIEW_VIEW, TaskOverviewView, readPinnedPath } from "./view";

export default class TaskOverviewPlugin extends Plugin {
	settings: TaskOverviewSettings = defaultSettings();
	private notePanelCommandIds: string[] = [];

	async onload(): Promise<void> {
		this.settings = migrateSettings(await this.loadData());

		this.registerView(TASK_OVERVIEW_VIEW, (leaf) => new TaskOverviewView(leaf, this));
		this.addSettingTab(new TaskOverviewSettingTab(this.app, this));

		this.addRibbonIcon("check-square", "Task overview", () => void this.revealPanel(null));
		this.addCommand({
			id: "open-panel",
			name: "Open task overview panel",
			callback: () => void this.revealPanel(null),
		});

		this.syncNotePanelCommands();
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.syncNotePanelCommands();
		for (const view of this.taskOverviewViews()) view.render();
	}

	private syncNotePanelCommands(): void {
		const ids = this.settings.notePanels.map(notePanelCommandId);

		for (const id of this.notePanelCommandIds) {
			if (!ids.includes(id)) this.removeNotePanelCommand(id);
		}

		for (const panel of this.settings.notePanels) {
			const id = notePanelCommandId(panel);
			if (this.notePanelCommandIds.includes(id)) continue;

			const path = panel.path;
			this.addCommand({
				id,
				name: `Open task overview for ${noteBasename(path)}`,
				callback: () => void this.revealPanel(path),
			});
		}

		this.notePanelCommandIds = ids;
	}

	private removeNotePanelCommand(id: string): void {
		// Obsidian's types leave open whether Plugin.removeCommand applies the plugin id prefix that
		// addCommand documents, so both forms are addressed and the one that never existed is a no-op.
		this.removeCommand(id);
		this.removeCommand(`${this.manifest.id}:${id}`);
	}

	private async revealPanel(pinnedPath: string | null): Promise<void> {
		const { workspace } = this.app;
		const open = workspace
			.getLeavesOfType(TASK_OVERVIEW_VIEW)
			.find((leaf) => readPinnedPath(leaf.getViewState().state) === pinnedPath);
		if (open) {
			await workspace.revealLeaf(open);
			return;
		}

		const leaf = workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({
			type: TASK_OVERVIEW_VIEW,
			active: true,
			state: pinnedPath ? { pinnedPath } : undefined,
		});
		await workspace.revealLeaf(leaf);
	}

	private taskOverviewViews(): TaskOverviewView[] {
		return this.app.workspace
			.getLeavesOfType(TASK_OVERVIEW_VIEW)
			.map((leaf) => leaf.view)
			.filter((view): view is TaskOverviewView => view instanceof TaskOverviewView);
	}
}

function notePanelCommandId(panel: NotePanelSettings): string {
	return `open-note-panel:${panel.path}`;
}
