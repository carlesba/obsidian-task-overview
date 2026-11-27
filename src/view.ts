import { ItemView, TFile, ViewStateResult, WorkspaceLeaf, debounce, moment, normalizePath } from "obsidian";
import type TaskOverviewPlugin from "./main";
import { renderFilterControl } from "./filter";
import { periodicPlugins } from "./obsidianPlugins";
import { PERIOD_LABELS, periodLocation, periodicNotePath } from "./periodic";
import type { Panel } from "./settings";
import { ResolvedNote, ResolvedSources, noteName, panelTitle, resolveSources, showsNoteHeaders } from "./sources";
import { openNote, renderTaskList } from "./taskList";
import { DEFAULT_STATUS_RULES, StatusRules, resolveStatusRules } from "./statuses";
import { Task, TaskFilter, countByState, matchesFilter, readTasks } from "./tasks";

export const TASK_OVERVIEW_VIEW = "task-overview";

const ABSENT_NOTE_LABELS = { "not-created": "not created yet", missing: "missing" } as const;

interface NoteTasks {
	note: ResolvedNote;
	file: TFile | null;
	tasks: Task[];
}

export class TaskOverviewView extends ItemView {
	private plugin: TaskOverviewPlugin;
	private panelId: string | undefined;
	private focusedFile: TFile | null = null;
	private resolved: ResolvedSources = { notes: [], unavailable: [] };
	private noteTasks: NoteTasks[] = [];
	private statusRules: StatusRules = DEFAULT_STATUS_RULES;
	private titleEl!: HTMLElement;
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
		return this.panel()?.name ?? "Task overview";
	}

	getIcon(): string {
		return this.panel()?.icon ?? "check-square";
	}

	getState(): Record<string, unknown> {
		return { ...super.getState(), panelId: this.panelId };
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		await super.setState(state, result);
		const stored = (state as { panelId?: unknown } | null)?.panelId;
		this.panelId = typeof stored === "string" ? stored : this.plugin.settings.panels[0]?.id;
		await this.refresh();
	}

	async onOpen(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.addClass("task-overview");

		const header = root.createDiv({ cls: "task-overview-header" });
		this.titleEl = header.createDiv({ cls: "task-overview-file" });
		this.filterEl = header.createDiv({ cls: "task-overview-filter" });
		this.listEl = root.createDiv({ cls: "task-overview-list" });

		const refresh = debounce(() => void this.refresh(), 120, true);
		const { workspace, metadataCache, vault } = this.app;
		this.registerEvent(workspace.on("file-open", refresh));
		this.registerEvent(workspace.on("active-leaf-change", refresh));
		this.registerEvent(
			metadataCache.on("changed", (file) => {
				if (this.resolved.notes.some((note) => note.path === file.path)) refresh();
			}),
		);
		this.registerEvent(vault.on("create", refresh));
		this.registerEvent(vault.on("delete", refresh));
		this.registerEvent(vault.on("rename", refresh));

		await this.refresh();
	}

	async refresh(): Promise<void> {
		const active = this.app.workspace.getActiveFile();
		if (active?.extension === "md") this.focusedFile = active;

		const read = ++this.pendingRead;
		const statusRules = await resolveStatusRules(this.app, this.plugin.settings);
		const resolved = this.resolveSources();
		const noteTasks = await Promise.all(
			resolved.notes.map(async (note): Promise<NoteTasks> => {
				const file = note.state === "found" ? this.app.vault.getFileByPath(note.path) : null;
				const tasks = file ? await readTasks(this.app, file, statusRules.read, statusRules.isHidden) : [];
				return { note, file, tasks };
			}),
		);
		if (read !== this.pendingRead) return;

		this.statusRules = statusRules;
		this.resolved = resolved;
		this.noteTasks = noteTasks;
		this.render();
		this.updateLeafHeader();
	}

	private panel(): Panel | undefined {
		const { panels } = this.plugin.settings;
		return this.panelId === undefined ? panels[0] : panels.find((panel) => panel.id === this.panelId);
	}

	private resolveSources(): ResolvedSources {
		const plugins = periodicPlugins(this.app);
		const today = moment();
		return resolveSources(this.panel()?.sources ?? [], {
			focusedPath: this.focusedFile?.path,
			periodicPath: (source) => {
				const location = periodLocation(source, plugins);
				return location && periodicNotePath(location, today, normalizePath);
			},
			exists: (path) => this.app.vault.getFileByPath(path) !== null,
		});
	}

	private updateLeafHeader(): void {
		(this.leaf as WorkspaceLeaf & { updateHeader?: () => void }).updateHeader?.();
	}

	private async setFilter(panel: Panel, filter: TaskFilter): Promise<void> {
		panel.filter = filter;
		await this.plugin.saveSettings();
	}

	private render(): void {
		if (!this.listEl) return;
		this.listEl.empty();

		const panel = this.panel();
		if (!panel) {
			this.titleEl.setText("");
			this.filterEl.empty();
			this.addEmptyMessage("This panel was deleted in the settings.");
			return;
		}

		const { notes, unavailable } = this.resolved;
		const waitsForFocus = !notes.length && panel.sources.some((source) => source.kind === "focused");
		this.titleEl.setText(panelTitle(panel, notes));
		this.titleEl.toggleClass("is-empty", waitsForFocus);

		renderFilterControl({
			container: this.filterEl,
			active: panel.filter,
			counts: countByState(this.noteTasks.flatMap(({ tasks }) => tasks)),
			onSelect: (next) => void this.setFilter(panel, next),
		});

		const showNoteHeaders = showsNoteHeaders(panel, notes);
		let listsTasks = false;
		for (const { note, file, tasks } of this.noteTasks) {
			if (!file) {
				if (showNoteHeaders) this.addAbsentNote(note);
				continue;
			}
			const visible = tasks.filter((task) => matchesFilter(task, panel.filter));
			if (!visible.length) continue;

			listsTasks = true;
			if (showNoteHeaders) this.addNoteHeader(file);
			renderTaskList({
				app: this.app,
				owner: this,
				container: this.listEl,
				file,
				tasks: visible,
				showHeadings: panel.showHeadings,
				readStatus: this.statusRules.read,
				followsTasksCycle: this.statusRules.followsTasksCycle,
				onTaskToggled: () => void this.refresh(),
			});
		}

		for (const period of unavailable) {
			this.addMutedNote(PERIOD_LABELS[period], "no plugin to follow, see the panel's settings");
		}
		if (!listsTasks) this.addEmptyMessage(waitsForFocus ? "Open a note to see its tasks." : this.emptyMessage(panel));
	}

	private addNoteHeader(file: TFile): void {
		const header = this.listEl.createDiv({ cls: "task-overview-note is-clickable", text: file.basename });
		header.addEventListener("click", () => void openNote(this.app, file));
	}

	private addAbsentNote(note: ResolvedNote): void {
		if (note.state !== "found") this.addMutedNote(noteName(note.path), ABSENT_NOTE_LABELS[note.state]);
	}

	private addMutedNote(name: string, reason: string): void {
		const header = this.listEl.createDiv({ cls: "task-overview-note is-absent", text: name });
		header.createSpan({ cls: "task-overview-note-reason", text: reason });
	}

	private addEmptyMessage(text: string): void {
		this.listEl.createDiv({ cls: "task-overview-empty", text });
	}

	private emptyMessage(panel: Panel): string {
		const { notes } = this.resolved;
		if (notes.length === 1 && notes[0].state !== "found") return `This note is ${ABSENT_NOTE_LABELS[notes[0].state]}.`;
		const where = notes.length === 1 ? "in this note" : "in this panel";
		if (panel.filter === "open") return `No open tasks ${where}.`;
		if (panel.filter === "closed") return `No completed or cancelled tasks ${where}.`;
		return `No tasks ${where}.`;
	}
}
