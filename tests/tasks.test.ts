import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
	countByState,
	isTaskLineRewrite,
	matchesFilter,
	readStatus,
	rewriteTaskLine,
	rewriteWhenTaskTextMatches,
	toggleStatusChar,
} from "../src/tasks.ts";
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

test("toggleStatusChar returns a closed task to todo and marks any other done", () => {
	assert.equal(toggleStatusChar("x"), " ");
	assert.equal(toggleStatusChar("X"), " ");
	assert.equal(toggleStatusChar("-"), " ");
	assert.equal(toggleStatusChar(" "), "x");
	assert.equal(toggleStatusChar("/"), "x");
	assert.equal(toggleStatusChar("?"), "x");
});

test("rewriteTaskLine puts a single rewritten line back in place", () => {
	const lines = ["# Note", "- [ ] water the plants", "- [ ] call mum"];

	assert.deepEqual(rewriteTaskLine(lines, 1, () => "- [x] water the plants"), [
		"# Note",
		"- [x] water the plants",
		"- [ ] call mum",
	]);
});

test("rewriteTaskLine grows the note by one when a rewrite returns two lines", () => {
	const lines = ["# Note", "- [ ] water the plants 🔁 every day", "- [ ] call mum"];

	assert.deepEqual(
		rewriteTaskLine(
			lines,
			1,
			() => "- [ ] water the plants 🔁 every day\n- [x] water the plants 🔁 every day",
		),
		[
			"# Note",
			"- [ ] water the plants 🔁 every day",
			"- [x] water the plants 🔁 every day",
			"- [ ] call mum",
		],
	);
});

test("rewriteTaskLine keeps the note as it was when the rewrite changes nothing", () => {
	const lines = ["# Note", "- [ ] water the plants"];

	assert.deepEqual(rewriteTaskLine(lines, 1, (line) => line), lines);
});

test("rewriteTaskLine leaves the note untouched for a line outside it", () => {
	const lines = ["# Note", "- [ ] water the plants"];
	const rewriteThatWouldFail = () => {
		throw new Error("the rewrite must not run for a line outside the note");
	};

	assert.deepEqual(rewriteTaskLine(lines, 9, rewriteThatWouldFail), lines);
	assert.deepEqual(rewriteTaskLine(lines, -1, rewriteThatWouldFail), lines);
	assert.deepEqual(rewriteTaskLine([], 0, rewriteThatWouldFail), []);
	assert.deepEqual(lines, ["# Note", "- [ ] water the plants"]);
});

test("rewriteWhenTaskTextMatches rewrites the line holding the clicked task", () => {
	const rewrite = rewriteWhenTaskTextMatches("water the plants", () => "- [x] water the plants");

	assert.equal(rewrite("- [ ] water the plants"), "- [x] water the plants");
	assert.equal(rewrite("\t* [/] water the plants"), "- [x] water the plants");
});

test("rewriteWhenTaskTextMatches leaves a line the clicked task moved away from", () => {
	const rewrite = rewriteWhenTaskTextMatches("water the plants", () => "- [x] water the plants");

	assert.equal(rewrite("- [ ] call mum"), "- [ ] call mum");
	assert.equal(rewrite("## Chores"), "## Chores");
	assert.equal(rewrite(""), "");
});

test("isTaskLineRewrite accepts one task line and a recurring pair", () => {
	assert.equal(isTaskLineRewrite("- [x] water the plants"), true);
	assert.equal(
		isTaskLineRewrite("- [ ] water the plants 🔁 every day\n- [x] water the plants 🔁 every day"),
		true,
	);
});

test("isTaskLineRewrite rejects a result that would delete the task", () => {
	assert.equal(isTaskLineRewrite(""), false);
	assert.equal(isTaskLineRewrite("water the plants"), false);
	assert.equal(isTaskLineRewrite("- [x] water the plants\n"), false);
	assert.equal(isTaskLineRewrite(undefined), false);
	assert.equal(isTaskLineRewrite(null), false);
});
