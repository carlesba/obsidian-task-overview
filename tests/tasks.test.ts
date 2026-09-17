import { test } from "node:test";
import { strict as assert } from "node:assert";
import { countByState, matchesFilter, readStatus } from "../src/tasks.ts";
import type { Task, TaskFilter, TaskStatus } from "../src/tasks.ts";

const STATUS_CHARS: Record<TaskStatus, string> = {
	todo: " ",
	"in-progress": "/",
	done: "x",
	cancelled: "-",
};

const FILTERED_BY_STATUS: Record<TaskStatus, Record<TaskFilter, boolean>> = {
	todo: { open: true, closed: false, all: true },
	"in-progress": { open: true, closed: false, all: true },
	done: { open: false, closed: true, all: true },
	cancelled: { open: false, closed: true, all: true },
};

function task(line: number, status: TaskStatus): Task {
	return {
		line,
		depth: 0,
		text: `task on line ${line}`,
		statusChar: STATUS_CHARS[status],
		status,
	};
}

test("readStatus maps the four default Tasks symbols", () => {
	assert.equal(readStatus(" "), "todo");
	assert.equal(readStatus("x"), "done");
	assert.equal(readStatus("X"), "done");
	assert.equal(readStatus("/"), "in-progress");
	assert.equal(readStatus("-"), "cancelled");
});

test("readStatus reads a symbol it does not know as todo", () => {
	assert.equal(readStatus("?"), "todo");
	assert.equal(readStatus(""), "todo");
});

test("matchesFilter sorts every status into the three filters", () => {
	for (const status of Object.keys(FILTERED_BY_STATUS) as TaskStatus[]) {
		for (const filter of Object.keys(FILTERED_BY_STATUS[status]) as TaskFilter[]) {
			assert.equal(
				matchesFilter(task(0, status), filter),
				FILTERED_BY_STATUS[status][filter],
				`${status} under the ${filter} filter`,
			);
		}
	}
});

test("countByState counts what each filter shows", () => {
	const counts = countByState([
		task(0, "todo"),
		task(1, "in-progress"),
		task(2, "done"),
		task(3, "cancelled"),
		task(4, "todo"),
	]);

	assert.deepEqual(counts, { open: 3, closed: 2, all: 5 });
});

test("countByState reports zeroes for an empty note", () => {
	assert.deepEqual(countByState([]), { open: 0, closed: 0, all: 0 });
});
