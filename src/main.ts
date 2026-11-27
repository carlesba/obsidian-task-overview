import { Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { DEFAULT_PANEL_ID, Panel, TaskOverviewSettings, defaultSettings, migrateSettings } from "./settings";
import { TaskOverviewSettingTab } from "./settingsTab";
import { followRename } from "./sources";
import { TASK_OVERVIEW_VIEW, TaskOverviewView } from "./view";

const MIDNIGHT_MARGIN_MS = 1000;

export default class TaskOverviewPlugin extends Plugin {
	settings: TaskOverviewSettings = defaultSettings();
	private commandIds: string[] = [];
	private commandSignature = "";
	private midnightTimer: number | undefined;
	private settingTab: TaskOverviewSettingTab | undefined;

	async onload(): Promise<void> {
		this.settings = migrateSettings(await this.loadData());

		this.registerView(TASK_OVERVIEW_VIEW, (leaf) => new TaskOverviewView(leaf, this));
		this.settingTab = new TaskOverviewSettingTab(this.app, this);
		this.addSettingTab(this.settingTab);

		this.addRibbonIcon("check-square", "Task overview", () => void this.openPanel(this.settings.panels[0]));
		this.syncCommands();

		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (file instanceof TFile && followRename(this.settings.panels, oldPath, file.path)) void this.saveSettings();
			}),
		);

		this.refreshAtMidnight();
		this.register(() => window.clearTimeout(this.midnightTimer));
	}

	async saveSettings(): Promise<void> {
		await this.saveWithoutRedrawingSettings();
		this.settingTab?.update();
	}

	async saveWithoutRedrawingSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.syncCommands();
		this.refreshViews();
	}

	async openPanel(panel: Panel | undefined): Promise<void> {
		if (!panel) return;
		const { workspace } = this.app;
		const open = this.leavesOf(panel)[0] ?? workspace.getRightLeaf(false);
		if (!open) return;
		if (open.getViewState().type !== TASK_OVERVIEW_VIEW) {
			await open.setViewState({ type: TASK_OVERVIEW_VIEW, active: true, state: { panelId: panel.id } });
		}
		await workspace.revealLeaf(open);
	}

	async deletePanel(panel: Panel): Promise<void> {
		for (const leaf of this.leavesOf(panel)) leaf.detach();
		this.settings.panels.remove(panel);
		await this.saveSettings();
	}

	private leavesOf(panel: Panel): WorkspaceLeaf[] {
		const firstPanelId = this.settings.panels[0]?.id;
		return this.app.workspace.getLeavesOfType(TASK_OVERVIEW_VIEW).filter((leaf) => {
			const stored = leaf.getViewState().state?.panelId;
			return (typeof stored === "string" ? stored : firstPanelId) === panel.id;
		});
	}

	private syncCommands(): void {
		const { panels } = this.settings;
		const signature = JSON.stringify(panels.map(({ id, name, icon }) => [id, name, icon]));
		if (signature === this.commandSignature) return;
		this.commandSignature = signature;

		for (const id of this.commandIds) this.removeCommand(id);
		this.commandIds = panels.map((panel) => {
			const id = panel.id === DEFAULT_PANEL_ID ? "open-panel" : `open-panel-${panel.id}`;
			this.addCommand({
				id,
				name: `Open ${panel.name}`,
				icon: panel.icon,
				callback: () => void this.openPanel(panel),
			});
			return id;
		});
	}

	private refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(TASK_OVERVIEW_VIEW)) {
			if (leaf.view instanceof TaskOverviewView) void leaf.view.refresh();
		}
	}

	private refreshAtMidnight(): void {
		const now = new Date();
		const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
		this.midnightTimer = window.setTimeout(() => {
			this.refreshViews();
			this.refreshAtMidnight();
		}, midnight.getTime() - now.getTime() + MIDNIGHT_MARGIN_MS);
	}
}
