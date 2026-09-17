import { ItemView, TFile, ViewStateResult, WorkspaceLeaf, debounce } from "obsidian";
import type TaskOverviewPlugin from "./main";
import { renderFilterControl } from "./filter";
import { PanelSettings, defaultPanelSettings, noteBasename } from "./settings";
import { renderTaskList } from "./taskList";
import { Task, TaskFilter, countByState, matchesFilter, readTasks } from "./tasks";

export const TASK_OVERVIEW_VIEW = "task-overview";

export class TaskOverviewView extends ItemView {
	private plugin: TaskOverviewPlugin;
	private trackedFile: TFile | null = null;
	private pinnedPath: string | null = null;
	private detachedSettings: PanelSettings | null = null;
	private tasks: Task[] = [];
	private fileNameEl!: HTMLElement;
	private filterEl!: HTMLElement;
	private listEl!: HTMLElement;
	private pendingRead = 0;

	constructor(leaf: WorkspaceLeaf, plugin: TaskOverviewPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return TASK_OVERVIEW_VIEW;
	}

	getDisplayText(): string {
		if (!this.pinnedPath) return "Task overview";
		return `Task overview: ${noteBasename(this.pinnedPath)}`;
	}

	getIcon(): string {
		return "check-square";
	}

	async onOpen(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.addClass("task-overview");

		const header = root.createDiv({ cls: "task-overview-header" });
		this.fileNameEl = header.createDiv({ cls: "task-overview-file" });
		this.filterEl = header.createDiv({ cls: "task-overview-filter" });
		this.listEl = root.createDiv({ cls: "task-overview-list" });

		const refresh = debounce(() => void this.refresh(), 120, true);
		this.registerEvent(
			this.app.workspace.on("file-open", () => {
				if (!this.pinnedPath) refresh();
			}),
		);
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				if (!this.pinnedPath) refresh();
			}),
		);
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (file.path === (this.pinnedPath ?? this.trackedFile?.path)) refresh();
			}),
		);

		await this.refresh();
	}

	getState(): Record<string, unknown> {
		const state = super.getState();
		if (this.pinnedPath) state.pinnedPath = this.pinnedPath;
		return state;
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const pinnedPath = readPinnedPath(state);
		if (pinnedPath !== this.pinnedPath) {
			this.pinnedPath = pinnedPath;
			this.trackedFile = null;
			this.detachedSettings = null;
		}

		await super.setState(state, result);
		if (this.listEl) await this.refresh();
	}

	async setFilter(filter: TaskFilter): Promise<void> {
		this.panelSettings.filter = filter;
		await this.plugin.saveSettings();
	}

	async refresh(): Promise<void> {
		const file = this.resolveFile();
		this.trackedFile = file;
		if (!file) {
			this.tasks = [];
			this.render();
			return;
		}

		const read = ++this.pendingRead;
		const tasks = await readTasks(this.app, file);
		if (read !== this.pendingRead) return;

		this.tasks = tasks;
		this.render();
	}

	render(): void {
		if (!this.listEl) return;

		const file = this.trackedFile;
		const panel = this.panelSettings;

		this.fileNameEl.setText(file ? file.basename : this.headerFallback());
		this.fileNameEl.toggleClass("is-empty", !file);

		renderFilterControl({
			container: this.filterEl,
			active: panel.filter,
			counts: countByState(this.tasks),
			onSelect: (next) => void this.setFilter(next),
		});

		if (!file) {
			this.listEl.empty();
			this.listEl.createDiv({ cls: "task-overview-empty", text: this.missingFileMessage() });
			return;
		}

		const visible = this.tasks.filter((task) => matchesFilter(task, panel.filter));
		if (!visible.length) {
			this.listEl.empty();
			this.listEl.createDiv({ cls: "task-overview-empty", text: this.emptyMessage(panel.filter) });
			return;
		}

		renderTaskList({
			app: this.app,
			owner: this,
			container: this.listEl,
			file,
			tasks: visible,
			showHeadings: panel.showHeadings,
			onTaskToggled: () => void this.refresh(),
		});
	}

	private get panelSettings(): PanelSettings {
		if (!this.pinnedPath) return this.plugin.settings.focusedPanel;

		const pinned = this.plugin.settings.notePanels.find((panel) => panel.path === this.pinnedPath);
		if (pinned) return pinned;

		if (!this.detachedSettings) this.detachedSettings = defaultPanelSettings();
		return this.detachedSettings;
	}

	private resolveFile(): TFile | null {
		if (this.pinnedPath) return this.app.vault.getFileByPath(this.pinnedPath);

		const active = this.app.workspace.getActiveFile();
		if (active?.extension === "md") return active;
		return this.trackedFile;
	}

	private headerFallback(): string {
		return this.pinnedPath ? noteBasename(this.pinnedPath) : "No note in focus";
	}

	private missingFileMessage(): string {
		if (this.pinnedPath) return "This note is no longer in the vault.";
		return "Open a note to see its tasks.";
	}

	private emptyMessage(filter: TaskFilter): string {
		if (filter === "open") return "No open tasks in this note.";
		if (filter === "closed") return "No completed tasks in this note.";
		return "No tasks in this note.";
	}
}

export function readPinnedPath(state: unknown): string | null {
	if (typeof state !== "object" || state === null) return null;
	const pinnedPath = (state as { pinnedPath?: unknown }).pinnedPath;
	return typeof pinnedPath === "string" && pinnedPath.length > 0 ? pinnedPath : null;
}
