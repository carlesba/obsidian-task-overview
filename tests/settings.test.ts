import { test } from "node:test";
import { strict as assert } from "node:assert";
import { defaultSettings, migrateSettings } from "../src/settings.ts";

test("migrateSettings falls back to the defaults when nothing is stored", () => {
	assert.deepEqual(migrateSettings(undefined), defaultSettings());
	assert.deepEqual(migrateSettings(null), defaultSettings());
	assert.deepEqual(migrateSettings("nonsense"), defaultSettings());
});

test("migrateSettings keeps the filter of an install that only stored one", () => {
	assert.deepEqual(migrateSettings({ filter: "closed" }), { filter: "closed", showHeadings: false });
});

test("migrateSettings reads the filter and headings of a panel-shaped install", () => {
	assert.deepEqual(migrateSettings({ focusedPanel: { filter: "all", showHeadings: true }, notePanels: [] }), {
		filter: "all",
		showHeadings: true,
	});
});

test("migrateSettings reads the current shape unchanged", () => {
	assert.deepEqual(migrateSettings({ filter: "all", showHeadings: true }), {
		filter: "all",
		showHeadings: true,
	});
});

test("migrateSettings rejects a filter that is not one of the three", () => {
	assert.deepEqual(migrateSettings({ filter: "archived" }), { filter: "open", showHeadings: false });
});
