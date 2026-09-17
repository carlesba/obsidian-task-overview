import type { App, HeadingCache, TFile } from "obsidian";

export type TaskStatus = "todo" | "in-progress" | "done" | "cancelled";

export type TaskFilter = "open" | "closed" | "all";

export interface TaskHeading {
	level: number;
	text: string;
	line: number;
}

export interface Task {
	line: number;
	depth: number;
	text: string;
	statusChar: string;
	status: TaskStatus;
	heading?: TaskHeading;
}

const TODO_STATUS_CHAR = " ";
const DONE_STATUS_CHAR = "x";
const TASK_LINE = /^(\s*)(?:[-*+]|\d+[.)])\s+\[(.)\]\s?(.*)$/;

export function readStatus(statusChar: string): TaskStatus {
	switch (statusChar) {
		case "x":
		case "X":
			return "done";
		case "/":
			return "in-progress";
		case "-":
			return "cancelled";
		default:
			return "todo";
	}
}

export function isClosedStatus(status: TaskStatus): boolean {
	return status === "done" || status === "cancelled";
}

export type TaskRow =
	| { kind: "heading"; heading: TaskHeading }
	| { kind: "task"; task: Task };

export function resolveHeading(headings: HeadingCache[], line: number): TaskHeading | undefined {
	let nearest: HeadingCache | undefined;

	for (const heading of headings) {
		const headingLine = heading.position.start.line;
		if (headingLine >= line) continue;
		if (nearest && nearest.position.start.line >= headingLine) continue;
		nearest = heading;
	}

	if (!nearest) return undefined;
	return { level: nearest.level, text: nearest.heading, line: nearest.position.start.line };
}

export function buildTaskRows(tasks: Task[], insertHeadingRows: boolean): TaskRow[] {
	const rows: TaskRow[] = [];
	let openHeadingLine: number | undefined;

	for (const task of tasks) {
		if (insertHeadingRows && task.heading && task.heading.line !== openHeadingLine) {
			rows.push({ kind: "heading", heading: task.heading });
		}
		openHeadingLine = task.heading?.line;
		rows.push({ kind: "task", task });
	}

	return rows;
}

export async function readTasks(app: App, file: TFile): Promise<Task[]> {
	const cache = app.metadataCache.getFileCache(file);
	const listItems = cache?.listItems;
	if (!listItems?.length) return [];

	const headings = cache?.headings ?? [];

	const lines = (await app.vault.cachedRead(file)).split("\n");
	const depthByLine = new Map<number, number>();
	const tasks: Task[] = [];

	for (const item of listItems) {
		const lineNumber = item.position.start.line;
		const parentLine = item.parent;
		const depth = parentLine >= 0 ? (depthByLine.get(parentLine) ?? 0) + 1 : 0;
		depthByLine.set(lineNumber, depth);

		if (typeof item.task !== "string") continue;
		const match = TASK_LINE.exec(lines[lineNumber] ?? "");
		if (!match) continue;

		const statusChar = item.task;
		tasks.push({
			line: lineNumber,
			depth,
			text: match[3].trim(),
			statusChar,
			status: readStatus(statusChar),
			heading: resolveHeading(headings, lineNumber),
		});
	}

	return tasks;
}

export function matchesFilter(task: Task, filter: TaskFilter): boolean {
	if (filter === "all") return true;
	return isClosedStatus(task.status) === (filter === "closed");
}

export function countByState(tasks: Task[]): Record<TaskFilter, number> {
	return {
		open: tasks.filter((task) => matchesFilter(task, "open")).length,
		closed: tasks.filter((task) => matchesFilter(task, "closed")).length,
		all: tasks.length,
	};
}

export async function toggleTask(app: App, file: TFile, task: Task): Promise<void> {
	const nextChar = isClosedStatus(task.status) ? TODO_STATUS_CHAR : DONE_STATUS_CHAR;
	await app.vault.process(file, (data) => {
		const lines = data.split("\n");
		const target = lines[task.line];
		if (target === undefined) return data;
		lines[task.line] = target.replace(/\[(.)\]/, `[${nextChar}]`);
		return lines.join("\n");
	});
}
