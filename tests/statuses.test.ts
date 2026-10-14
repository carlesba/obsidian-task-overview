import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
	symbolListError,
	parseSymbolList,
	readTasksStatusConfigurations,
	hiddenMarksFor,
	resolveStatusRules,
	statusRulesFor,
	statusReaderFor,
} from "../src/statuses.ts";
import { defaultSettings } from "../src/settings.ts";
import type { App } from "obsidian";
import type { TaskOverviewSettings } from "../src/settings.ts";
import type { TasksStatusConfiguration } from "../src/statuses.ts";

const MARKS = [" ", "x", "X", "-", "/", ">", "!", "?"];

function statusesOf(read: (statusChar: string) => string): Record<string, string> {
	return Object.fromEntries(MARKS.map((mark) => [mark, read(mark)]));
}

test("done and cancelled mode closes x, X and - and nothing else", () => {
	assert.deepEqual(statusesOf(statusReaderFor("done-and-cancelled", "")), {
		" ": "todo",
		x: "done",
		X: "done",
		"-": "cancelled",
		"/": "in-progress",
		">": "todo",
		"!": "todo",
		"?": "todo",
	});
});

test("any-mark mode closes every character except a space", () => {
	assert.deepEqual(statusesOf(statusReaderFor("any-mark", "")), {
		" ": "todo",
		x: "done",
		X: "done",
		"-": "cancelled",
		"/": "done",
		">": "done",
		"!": "done",
		"?": "done",
	});
});

test("listed mode closes exactly the listed characters", () => {
	assert.deepEqual(statusesOf(statusReaderFor("listed", "x, >, !")), {
		" ": "todo",
		x: "done",
		X: "todo",
		"-": "todo",
		"/": "in-progress",
		">": "done",
		"!": "done",
		"?": "todo",
	});
});

test("listed mode keeps cancelled for - when it is listed", () => {
	assert.equal(statusReaderFor("listed", "-")("-"), "cancelled");
});

test("listed mode with nothing listed closes nothing", () => {
	const read = statusReaderFor("listed", "");
	assert.ok(MARKS.every((mark) => read(mark) === "todo" || read(mark) === "in-progress"));
});

test("parseSymbolList splits on commas and drops spaces and empty entries", () => {
	assert.deepEqual(parseSymbolList(" x,>,, ! ,"), ["x", ">", "!"]);
	assert.deepEqual(parseSymbolList(""), []);
});

test("symbolListError rejects entries longer than one character", () => {
	assert.equal(symbolListError("x, -, >"), undefined);
	assert.equal(symbolListError(""), undefined);
	assert.equal(symbolListError("x, done, >>"), "Each entry must be a single character: done, >>");
});

const TASKS_STATUSES: TasksStatusConfiguration[] = [
	{ symbol: " ", type: "TODO" },
	{ symbol: "x", type: "DONE" },
	{ symbol: "/", type: "IN_PROGRESS" },
	{ symbol: "-", type: "CANCELLED" },
	{ symbol: ">", type: "DONE" },
	{ symbol: "!", type: "TODO" },
	{ symbol: "?", type: "ON_HOLD" },
];

test("tasks-plugin mode follows each symbol's Tasks type", () => {
	assert.deepEqual(statusesOf(statusReaderFor("tasks-plugin", "", TASKS_STATUSES)), {
		" ": "todo",
		x: "done",
		X: "done",
		"-": "cancelled",
		"/": "in-progress",
		">": "done",
		"!": "todo",
		"?": "todo",
	});
});

test("tasks-plugin mode lets the Tasks type override the built-in meaning", () => {
	const read = statusReaderFor("tasks-plugin", "", [{ symbol: "x", type: "TODO" }]);
	assert.equal(read("x"), "todo");
	assert.equal(read("-"), "cancelled");
});

test("tasks-plugin mode without Tasks statuses falls back to done and cancelled", () => {
	assert.deepEqual(
		statusesOf(statusReaderFor("tasks-plugin", "")),
		statusesOf(statusReaderFor("done-and-cancelled", "")),
	);
});

test("readTasksStatusConfigurations reads core and custom statuses from the Tasks data", () => {
	const statuses = readTasksStatusConfigurations({
		statusSettings: {
			coreStatuses: [{ symbol: " ", name: "Todo", nextStatusSymbol: "x", type: "TODO" }],
			customStatuses: [{ symbol: ">", name: "Forwarded", nextStatusSymbol: "x", type: "DONE" }, { symbol: 3 }],
		},
	});
	assert.deepEqual(
		statuses?.map(({ symbol, type }) => [symbol, type]),
		[
			[" ", "TODO"],
			[">", "DONE"],
		],
	);
});

test("readTasksStatusConfigurations returns nothing for Tasks data without statuses", () => {
	assert.equal(readTasksStatusConfigurations(undefined), undefined);
	assert.equal(readTasksStatusConfigurations({}), undefined);
	assert.equal(readTasksStatusConfigurations({ statusSettings: { coreStatuses: "broken" } }), undefined);
});

function appWithTasksData(loadData?: () => Promise<unknown>): App {
	return {
		plugins: { plugins: loadData ? { "obsidian-tasks-plugin": { loadData } } : {} },
	} as unknown as App;
}

function settingsWith(overrides: Partial<TaskOverviewSettings>): TaskOverviewSettings {
	return { ...defaultSettings(), ...overrides };
}

test("resolveStatusRules reads the Tasks plugin's saved statuses in tasks-plugin mode", async () => {
	const app = appWithTasksData(async () => ({
		statusSettings: { coreStatuses: [], customStatuses: [{ symbol: ">", type: "DONE" }] },
	}));
	const { read } = await resolveStatusRules(app, settingsWith({ closingStatuses: "tasks-plugin" }));
	assert.equal(read(">"), "done");
});

test("resolveStatusRules falls back when the Tasks plugin is missing or its data fails to load", async () => {
	const settings = settingsWith({ closingStatuses: "tasks-plugin" });
	const missing = (await resolveStatusRules(appWithTasksData(), settings)).read;
	const failing = (
		await resolveStatusRules(
			appWithTasksData(async () => {
				throw new Error("unreadable data.json");
			}),
			settings,
		)
	).read;
	for (const read of [missing, failing]) {
		assert.equal(read(">"), "todo");
		assert.equal(read("x"), "done");
	}
});

test("resolveStatusRules does not read Tasks data outside tasks-plugin mode", async () => {
	let loads = 0;
	const app = appWithTasksData(async () => {
		loads++;
		return {};
	});
	const { read } = await resolveStatusRules(app, settingsWith({ closingStatuses: "listed", closingSymbols: ">" }));
	assert.equal(read(">"), "done");
	assert.equal(loads, 0);
});

const WITH_NON_TASKS: TasksStatusConfiguration[] = [
	...TASKS_STATUSES,
	{ symbol: "i", type: "NON_TASK" },
	{ symbol: "~", type: "NON_TASK" },
];

test("no hidden statuses keeps every mark in the panel", () => {
	const isHidden = hiddenMarksFor("none", "i", WITH_NON_TASKS);
	assert.ok([...MARKS, "i", "~"].every((mark) => !isHidden(mark)));
});

test("listed hidden statuses hide exactly the listed characters", () => {
	const isHidden = hiddenMarksFor("listed", " i, ? ,");
	assert.deepEqual(
		[...MARKS, "i"].filter(isHidden),
		["?", "i"],
	);
});

test("tasks-plugin hidden statuses hide the symbols Tasks types as non-task", () => {
	const isHidden = hiddenMarksFor("tasks-plugin", "?", WITH_NON_TASKS);
	assert.deepEqual(
		[...MARKS, "i", "~"].filter(isHidden),
		["i", "~"],
	);
});

test("tasks-plugin hidden statuses hide nothing without Tasks statuses", () => {
	const isHidden = hiddenMarksFor("tasks-plugin", "");
	assert.ok([...MARKS, "i"].every((mark) => !isHidden(mark)));
});

test("statusRulesFor combines the closing rule, the hidden rule and the Tasks cycle", () => {
	const rules = statusRulesFor(
		settingsWith({ closingStatuses: "listed", closingSymbols: ">", hiddenStatuses: "listed", hiddenSymbols: "i" }),
	);
	assert.equal(rules.read(">"), "done");
	assert.equal(rules.isHidden("i"), true);
	assert.equal(rules.isHidden(">"), false);
	assert.equal(rules.followsTasksCycle, false);
	assert.equal(statusRulesFor(settingsWith({ closingStatuses: "tasks-plugin" })).followsTasksCycle, true);
});

test("resolveStatusRules loads Tasks statuses when only the hidden rule follows Tasks", async () => {
	let loads = 0;
	const app = appWithTasksData(async () => {
		loads++;
		return { statusSettings: { coreStatuses: [], customStatuses: [{ symbol: "i", type: "NON_TASK" }] } };
	});
	const rules = await resolveStatusRules(app, settingsWith({ hiddenStatuses: "tasks-plugin" }));
	assert.equal(loads, 1);
	assert.equal(rules.isHidden("i"), true);
	assert.equal(rules.read("x"), "done");
});
