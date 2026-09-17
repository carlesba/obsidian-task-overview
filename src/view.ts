import { ItemView, TFile, WorkspaceLeaf, debounce } from "obsidian";
import type TaskOverviewPlugin from "./main";
import { renderFilterControl } from "./filter";
import { renderTaskList } from "./taskList";
import { Task, TaskFilter, countByState, matchesFilter, readTasks } from "./tasks";

export const TASK_OVERVIEW_VIEW = "task-overview";

export class TaskOverviewView extends ItemView {
	private plugin: TaskOverviewPlugin;
	private trackedFile: TFile | null = null;
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
		return "Task overview";
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
		this.registerEvent(this.app.workspace.on("file-open", () => refresh()));
		this.registerEvent(this.app.workspace.on("active-leaf-change", () => refresh()));
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (file.path === this.trackedFile?.path) refresh();
			}),
		);

		await this.refresh();
	}

	async setFilter(filter: TaskFilter): Promise<void> {
		this.plugin.settings.filter = filter;
		await this.plugin.saveSettings();
		this.render();
	}

	async refresh(): Promise<void> {
		const active = this.app.workspace.getActiveFile();
		if (active?.extension === "md") this.trackedFile = active;

		const file = this.trackedFile;
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

	private render(): void {
		const file = this.trackedFile;
		const filter = this.plugin.settings.filter;

		this.fileNameEl.setText(file ? file.basename : "No note in focus");
		this.fileNameEl.toggleClass("is-empty", !file);

		renderFilterControl({
			container: this.filterEl,
			active: filter,
			counts: countByState(this.tasks),
			onSelect: (next) => void this.setFilter(next),
		});

		if (!file) {
			this.listEl.empty();
			this.listEl.createDiv({ cls: "task-overview-empty", text: "Open a note to see its tasks." });
			return;
		}

		const visible = this.tasks.filter((task) => matchesFilter(task, filter));
		if (!visible.length) {
			this.listEl.empty();
			this.listEl.createDiv({ cls: "task-overview-empty", text: this.emptyMessage(filter) });
			return;
		}

		renderTaskList({
			app: this.app,
			owner: this,
			container: this.listEl,
			file,
			tasks: visible,
			onTaskToggled: () => void this.refresh(),
		});
	}

	private emptyMessage(filter: TaskFilter): string {
		if (filter === "open") return "No open tasks in this note.";
		if (filter === "closed") return "No completed tasks in this note.";
		return "No tasks in this note.";
	}
}
