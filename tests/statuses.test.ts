import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
	closingSymbolsError,
	parseClosingSymbols,
	readTasksStatusConfigurations,
	resolveStatusReader,
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

test("parseClosingSymbols splits on commas and drops spaces and empty entries", () => {
	assert.deepEqual(parseClosingSymbols(" x,>,, ! ,"), ["x", ">", "!"]);
	assert.deepEqual(parseClosingSymbols(""), []);
});

test("closingSymbolsError rejects entries longer than one character", () => {
	assert.equal(closingSymbolsError("x, -, >"), undefined);
	assert.equal(closingSymbolsError(""), undefined);
	assert.equal(closingSymbolsError("x, done, >>"), "Each entry must be a single character: done, >>");
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

test("resolveStatusReader reads the Tasks plugin's saved statuses in tasks-plugin mode", async () => {
	const app = appWithTasksData(async () => ({
		statusSettings: { coreStatuses: [], customStatuses: [{ symbol: ">", type: "DONE" }] },
	}));
	const read = await resolveStatusReader(app, settingsWith({ closingStatuses: "tasks-plugin" }));
	assert.equal(read(">"), "done");
});

test("resolveStatusReader falls back when the Tasks plugin is missing or its data fails to load", async () => {
	const settings = settingsWith({ closingStatuses: "tasks-plugin" });
	const missing = await resolveStatusReader(appWithTasksData(), settings);
	const failing = await resolveStatusReader(
		appWithTasksData(async () => {
			throw new Error("unreadable data.json");
		}),
		settings,
	);
	for (const read of [missing, failing]) {
		assert.equal(read(">"), "todo");
		assert.equal(read("x"), "done");
	}
});

test("resolveStatusReader does not read Tasks data outside tasks-plugin mode", async () => {
	let loads = 0;
	const app = appWithTasksData(async () => {
		loads++;
		return {};
	});
	const read = await resolveStatusReader(app, settingsWith({ closingStatuses: "listed", closingSymbols: ">" }));
	assert.equal(read(">"), "done");
	assert.equal(loads, 0);
});
