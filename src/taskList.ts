import { App, Component, MarkdownRenderer, TFile } from "obsidian";
import { Task, TaskHeading, buildTaskRows, isClosedStatus, toggleTask } from "./tasks";

export interface TaskListProps {
	app: App;
	owner: Component;
	container: HTMLElement;
	file: TFile;
	tasks: Task[];
	showHeadings?: boolean;
	onTaskToggled: () => void;
}

export function renderTaskList(props: TaskListProps): void {
	props.container.empty();

	for (const row of buildTaskRows(props.tasks, props.showHeadings === true)) {
		if (row.kind === "heading") {
			renderHeadingRow(props.container, row.heading);
			continue;
		}

		renderTaskRow(props, row.task);
	}
}

function renderHeadingRow(container: HTMLElement, heading: TaskHeading): void {
	const row = container.createDiv({ cls: "task-overview-heading", text: heading.text });
	row.setAttribute("data-level", String(heading.level));
}

function renderTaskRow(props: TaskListProps, task: Task): void {
	const row = props.container.createDiv({ cls: "task-overview-item" });
	row.addClass(`is-${task.status}`);
	row.style.setProperty("--task-depth", String(task.depth));

	const checkbox = row.createEl("input", {
		cls: "task-overview-item-checkbox",
		type: "checkbox",
	});
	checkbox.checked = isClosedStatus(task.status);
	checkbox.addEventListener("click", (event) => {
		event.stopPropagation();
		void toggleTask(props.app, props.file, task).then(() => props.onTaskToggled());
	});

	const label = row.createDiv({ cls: "task-overview-item-label" });
	void MarkdownRenderer.render(props.app, task.text, label, props.file.path, props.owner);

	row.addEventListener("click", () => void revealTaskLine(props.app, props.file, task));
}

async function revealTaskLine(app: App, file: TFile, task: Task): Promise<void> {
	const leaf = app.workspace.getMostRecentLeaf() ?? app.workspace.getLeaf(true);
	const position = { line: task.line, ch: 0 };
	await leaf.openFile(file, {
		eState: { line: task.line, cursor: { from: position, to: position } },
	});
}
