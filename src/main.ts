import { Plugin, TAbstractFile, TFile, WorkspaceLeaf } from "obsidian";
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

		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => void this.followRenamedNotePanel(file, oldPath)),
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.syncNotePanelCommands();
		for (const view of this.taskOverviewViews()) view.render();
	}

	private syncNotePanelCommands(): void {
		const ids = this.settings.notePanels.map(notePanelCommandId);

		for (const id of this.notePanelCommandIds) {
			if (!ids.includes(id)) this.removeCommand(id);
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

	private async followRenamedNotePanel(file: TAbstractFile, oldPath: string): Promise<void> {
		if (!(file instanceof TFile)) return;

		const panel = this.settings.notePanels.find((entry) => entry.path === oldPath);
		if (!panel) return;

		panel.path = file.path;
		for (const leaf of this.leavesPinnedTo(oldPath)) {
			const current = leaf.getViewState();
			await leaf.setViewState({
				...current,
				state: { ...(current.state ?? {}), pinnedPath: file.path },
			});
		}

		await this.saveSettings();
	}

	private leavesPinnedTo(path: string): WorkspaceLeaf[] {
		return this.app.workspace
			.getLeavesOfType(TASK_OVERVIEW_VIEW)
			.filter((leaf) => readPinnedPath(leaf.getViewState().state) === path);
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
