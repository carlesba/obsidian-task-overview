import { App, Component, MarkdownRenderer, MarkdownView, TFile, WorkspaceLeaf } from "obsidian";
import { Task, toggleTask } from "./tasks";

export interface TaskListProps {
	app: App;
	owner: Component;
	container: HTMLElement;
	file: TFile;
	tasks: Task[];
	onTaskToggled: () => void;
}

export function renderTaskList(props: TaskListProps): void {
	props.container.empty();
	for (const task of props.tasks) renderTaskRow(props, task);
}

function renderTaskRow(props: TaskListProps, task: Task): void {
	const row = props.container.createDiv({ cls: "task-overview-item" });
	row.toggleClass("is-closed", task.state === "closed");
	row.style.setProperty("--task-depth", String(task.depth));

	const checkbox = row.createEl("input", {
		cls: "task-overview-item-checkbox",
		type: "checkbox",
	});
	checkbox.checked = task.state === "closed";

	let toggleInFlight = false;
	checkbox.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		if (toggleInFlight) return;
		toggleInFlight = true;
		void toggleAndNotify(props, task);
	});

	const label = row.createDiv({ cls: "task-overview-item-label" });
	void MarkdownRenderer.render(props.app, task.text, label, props.file.path, props.owner);

	row.addEventListener("click", (event) => {
		if (targetsRenderedLink(event)) return;
		void revealTask(props, task);
	});
}

async function toggleAndNotify(props: TaskListProps, task: Task): Promise<void> {
	try {
		await toggleTask(props.app, props.file, task);
	} finally {
		props.onTaskToggled();
	}
}

function targetsRenderedLink(event: MouseEvent): boolean {
	const target = event.target;
	if (!(target instanceof Element)) return false;
	return target.closest(".task-overview-item-label a") !== null;
}

async function revealTask(props: TaskListProps, task: Task): Promise<void> {
	const { app, file } = props;
	const leaf = leafShowingFile(app, file) ?? app.workspace.getLeaf(false);

	await leaf.openFile(file, { active: true, eState: { line: task.line } });
	app.workspace.setActiveLeaf(leaf, { focus: true });

	const view = leaf.view;
	if (!(view instanceof MarkdownView)) return;
	if (task.line >= view.editor.lineCount()) return;

	const cursor = { line: task.line, ch: view.editor.getLine(task.line).length };
	view.editor.setCursor(cursor);
	view.editor.scrollIntoView({ from: cursor, to: cursor }, true);
}

function leafShowingFile(app: App, file: TFile): WorkspaceLeaf | null {
	let match: WorkspaceLeaf | null = null;
	app.workspace.iterateRootLeaves((leaf) => {
		if (match) return;
		const view = leaf.view;
		if (view instanceof MarkdownView && view.file?.path === file.path) match = leaf;
	});
	return match;
}
