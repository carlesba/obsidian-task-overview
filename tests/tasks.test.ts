import { test } from "node:test";
import { strict as assert } from "node:assert";
import { countByState, matchesFilter } from "../src/tasks.ts";
import type { Task, TaskState } from "../src/tasks.ts";

function task(line: number, state: TaskState): Task {
	return {
		line,
		depth: 0,
		text: `task on line ${line}`,
		statusChar: state === "open" ? " " : "x",
		state,
	};
}

test("matchesFilter keeps every task when the filter is all", () => {
	assert.equal(matchesFilter(task(0, "open"), "all"), true);
	assert.equal(matchesFilter(task(1, "closed"), "all"), true);
});

test("matchesFilter keeps only the tasks in the filtered state", () => {
	assert.equal(matchesFilter(task(0, "open"), "open"), true);
	assert.equal(matchesFilter(task(0, "open"), "closed"), false);
	assert.equal(matchesFilter(task(1, "closed"), "closed"), true);
	assert.equal(matchesFilter(task(1, "closed"), "open"), false);
});

test("countByState counts each state and the total", () => {
	const counts = countByState([
		task(0, "open"),
		task(1, "closed"),
		task(2, "open"),
	]);

	assert.deepEqual(counts, { open: 2, closed: 1, all: 3 });
});

test("countByState reports zeroes for an empty note", () => {
	assert.deepEqual(countByState([]), { open: 0, closed: 0, all: 0 });
});
