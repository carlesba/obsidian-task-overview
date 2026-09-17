import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildTaskRows, resolveHeading } from "../src/tasks.ts";
import type { Task, TaskHeading } from "../src/tasks.ts";
import type { HeadingCache } from "obsidian";

function cachedHeading(level: number, text: string, line: number): HeadingCache {
	return {
		level,
		heading: text,
		position: {
			start: { line, col: 0, offset: 0 },
			end: { line, col: text.length, offset: text.length },
		},
	};
}

function task(line: number, heading?: TaskHeading): Task {
	return {
		line,
		depth: 0,
		text: `task on line ${line}`,
		statusChar: " ",
		state: "open",
		heading,
	};
}

test("resolveHeading finds nothing in a note without headings", () => {
	assert.equal(resolveHeading([], 4), undefined);
});

test("resolveHeading finds nothing for a task above the first heading", () => {
	assert.equal(resolveHeading([cachedHeading(1, "Today", 5)], 2), undefined);
});

test("resolveHeading picks the level 2 heading following a level 1", () => {
	const headings = [cachedHeading(1, "Week", 0), cachedHeading(2, "Monday", 4)];

	assert.deepEqual(resolveHeading(headings, 6), { level: 2, text: "Monday", line: 4 });
});

test("resolveHeading picks the deeper heading following a shallower one", () => {
	const headings = [
		cachedHeading(1, "Project", 0),
		cachedHeading(2, "Milestones", 3),
		cachedHeading(4, "Blocked", 9),
	];

	assert.deepEqual(resolveHeading(headings, 11), { level: 4, text: "Blocked", line: 9 });
});

test("resolveHeading picks the heading on the line right above the task", () => {
	const headings = [cachedHeading(3, "Errands", 7)];

	assert.deepEqual(resolveHeading(headings, 8), { level: 3, text: "Errands", line: 7 });
	assert.equal(resolveHeading(headings, 7), undefined);
});

test("buildTaskRows opens one heading row per run of tasks under the same heading", () => {
	const week = { level: 1, text: "Week", line: 0 };
	const monday = { level: 2, text: "Monday", line: 4 };

	const rows = buildTaskRows([task(1, week), task(2, week), task(5, monday)], true);

	assert.deepEqual(
		rows.map((row) => (row.kind === "heading" ? row.heading.text : `task ${row.task.line}`)),
		["Week", "task 1", "task 2", "Monday", "task 5"],
	);
});

test("buildTaskRows leaves tasks above the first heading without a row", () => {
	const week = { level: 1, text: "Week", line: 3 };

	const rows = buildTaskRows([task(1), task(4, week)], true);

	assert.deepEqual(
		rows.map((row) => (row.kind === "heading" ? row.heading.text : `task ${row.task.line}`)),
		["task 1", "Week", "task 4"],
	);
});

test("buildTaskRows reopens a heading when its run of tasks is interrupted", () => {
	const week = { level: 1, text: "Week", line: 0 };
	const monday = { level: 2, text: "Monday", line: 4 };

	const rows = buildTaskRows([task(1, week), task(5, monday), task(9, week)], true);

	assert.deepEqual(
		rows.map((row) => (row.kind === "heading" ? row.heading.text : `task ${row.task.line}`)),
		["Week", "task 1", "Monday", "task 5", "Week", "task 9"],
	);
});

test("buildTaskRows separates two headings that share a level and a text", () => {
	const firstTasks = { level: 2, text: "Tasks", line: 2 };
	const secondTasks = { level: 2, text: "Tasks", line: 8 };

	const rows = buildTaskRows([task(3, firstTasks), task(9, secondTasks)], true);

	assert.deepEqual(
		rows.map((row) => (row.kind === "heading" ? `heading ${row.heading.line}` : `task ${row.task.line}`)),
		["heading 2", "task 3", "heading 8", "task 9"],
	);
});

test("buildTaskRows emits no heading rows when heading rows are off", () => {
	const week = { level: 1, text: "Week", line: 0 };

	const rows = buildTaskRows([task(1, week), task(2, week)], false);

	assert.deepEqual(rows.map((row) => row.kind), ["task", "task"]);
});
