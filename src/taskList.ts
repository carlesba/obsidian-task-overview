import { App, Component, MarkdownRenderer, TFile } from "obsidian";
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

	for (const task of props.tasks) {
		const row = props.container.createDiv({ cls: "task-overview-item" });
		row.toggleClass("is-closed", task.state === "closed");
		row.style.setProperty("--task-depth", String(task.depth));

		const checkbox = row.createEl("input", {
			cls: "task-overview-item-checkbox",
			type: "checkbox",
		});
		checkbox.checked = task.state === "closed";
		checkbox.addEventListener("click", (event) => {
			event.stopPropagation();
			void toggleTask(props.app, props.file, task).then(() => props.onTaskToggled());
		});

		const label = row.createDiv({ cls: "task-overview-item-label" });
		void MarkdownRenderer.render(props.app, task.text, label, props.file.path, props.owner);

		row.addEventListener("click", () => void revealTaskLine(props.app, props.file, task));
	}
}

async function revealTaskLine(app: App, file: TFile, task: Task): Promise<void> {
	const leaf = app.workspace.getMostRecentLeaf() ?? app.workspace.getLeaf(true);
	const position = { line: task.line, ch: 0 };
	await leaf.openFile(file, {
		eState: { line: task.line, cursor: { from: position, to: position } },
	});
}
