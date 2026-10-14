import { test } from "node:test";
import { strict as assert } from "node:assert";
import { defaultSettings, migrateSettings } from "../src/settings.ts";

test("migrateSettings falls back to the defaults when nothing is stored", () => {
	assert.deepEqual(migrateSettings(undefined), defaultSettings());
	assert.deepEqual(migrateSettings(null), defaultSettings());
	assert.deepEqual(migrateSettings("nonsense"), defaultSettings());
});

test("migrateSettings keeps the filter of an install that only stored one", () => {
	assert.deepEqual(migrateSettings({ filter: "closed" }), { ...defaultSettings(), filter: "closed" });
});

test("migrateSettings reads the filter and headings of a panel-shaped install", () => {
	assert.deepEqual(migrateSettings({ focusedPanel: { filter: "all", showHeadings: true }, notePanels: [] }), {
		...defaultSettings(),
		filter: "all",
		showHeadings: true,
	});
});

test("migrateSettings reads the current shape unchanged", () => {
	assert.deepEqual(migrateSettings({ filter: "all", showHeadings: true }), {
		...defaultSettings(),
		filter: "all",
		showHeadings: true,
	});
});

test("migrateSettings rejects a filter that is not one of the three", () => {
	assert.deepEqual(migrateSettings({ filter: "archived" }), defaultSettings());
});

test("defaultSettings closes only done and cancelled tasks", () => {
	assert.equal(defaultSettings().closingStatuses, "done-and-cancelled");
	assert.equal(defaultSettings().closingSymbols, "");
});

test("migrateSettings reads every closing-status mode and the listed characters", () => {
	for (const closingStatuses of ["done-and-cancelled", "any-mark", "listed", "tasks-plugin"]) {
		assert.equal(migrateSettings({ closingStatuses }).closingStatuses, closingStatuses);
	}
	assert.equal(migrateSettings({ closingStatuses: "listed", closingSymbols: "x, >" }).closingSymbols, "x, >");
});

test("migrateSettings falls back to done and cancelled for an unknown mode or symbols", () => {
	const migrated = migrateSettings({ closingStatuses: "everything", closingSymbols: 42 });
	assert.equal(migrated.closingStatuses, "done-and-cancelled");
	assert.equal(migrated.closingSymbols, "");
});
