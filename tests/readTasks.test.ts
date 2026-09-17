import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readTasks, toggleTask } from "../src/tasks.ts";
import type { Task, TaskStatus } from "../src/tasks.ts";
import type { App, ListItemCache, TFile } from "obsidian";

const NOTE_FILE = {} as unknown as TFile;

function cachedListItem(line: number, statusChar?: string, parent = -1): ListItemCache {
	return {
		position: {
			start: { line, col: 0, offset: 0 },
			end: { line, col: 0, offset: 0 },
		},
		parent,
		task: statusChar,
	};
}

function readingApp(content: string, listItems: ListItemCache[]): App {
	return {
		metadataCache: { getFileCache: () => ({ listItems, headings: [] }) },
		vault: { cachedRead: async () => content },
	} as unknown as App;
}

async function lineAfterToggle(line: string, status: TaskStatus, text = "write it"): Promise<string> {
	let toggled = line;
	const app = {
		vault: {
			process: async (_file: TFile, mutate: (data: string) => string) => {
				toggled = mutate(line);
				return toggled;
			},
		},
	} as unknown as App;
	const task: Task = { line: 0, depth: 0, text, statusChar: "", status };

	await toggleTask(app, NOTE_FILE, task);
	return toggled;
}

test("readTasks reads every default status symbol from the cache", async () => {
	const content = "- [ ] todo\n- [/] in progress\n- [x] done\n- [-] cancelled";
	const listItems = [
		cachedListItem(0, " "),
		cachedListItem(1, "/"),
		cachedListItem(2, "x"),
		cachedListItem(3, "-"),
	];

	const tasks = await readTasks(readingApp(content, listItems), NOTE_FILE);

	assert.deepEqual(
		tasks.map((task) => task.status),
		["todo", "in-progress", "done", "cancelled"],
	);
	assert.deepEqual(
		tasks.map((task) => task.text),
		["todo", "in progress", "done", "cancelled"],
	);
});

test("readTasks takes the status from the cache, not from the line", async () => {
	const tasks = await readTasks(readingApp("- [ ] stale text", [cachedListItem(0, "/")]), NOTE_FILE);

	assert.equal(tasks.length, 1);
	assert.equal(tasks[0].status, "in-progress");
});

test("readTasks skips a list item the cache does not call a task", async () => {
	const content = "- plain bullet\n- [x] done";
	const listItems = [cachedListItem(0), cachedListItem(1, "x")];

	const tasks = await readTasks(readingApp(content, listItems), NOTE_FILE);

	assert.deepEqual(
		tasks.map((task) => task.line),
		[1],
	);
});

test("toggleTask closes a task that is not done or cancelled", async () => {
	assert.equal(await lineAfterToggle("- [ ] write it", "todo"), "- [x] write it");
	assert.equal(await lineAfterToggle("- [/] write it", "in-progress"), "- [x] write it");
});

test("toggleTask reopens a done or cancelled task", async () => {
	assert.equal(await lineAfterToggle("- [x] write it", "done"), "- [ ] write it");
	assert.equal(await lineAfterToggle("- [-] write it", "cancelled"), "- [ ] write it");
});

test("toggleTask leaves the line alone when it no longer holds the clicked task", async () => {
	assert.equal(await lineAfterToggle("- [ ] write it", "todo", "read it"), "- [ ] write it");
	assert.equal(await lineAfterToggle("## Write it", "todo"), "## Write it");
});
