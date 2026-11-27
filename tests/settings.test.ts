import { test } from "node:test";
import { strict as assert } from "node:assert";
import { defaultSettings, migrateSettings } from "../src/settings.ts";

const FOCUSED_PANEL = {
	id: "default",
	name: "Task overview",
	icon: "check-square",
	sources: [{ kind: "focused" }],
	filter: "open",
	showHeadings: false,
	showNoteHeaders: true,
};

test("a new install gets one panel for the focused note, open tasks, no headings", () => {
	assert.deepEqual(defaultSettings().panels, [FOCUSED_PANEL]);
});

test("migrateSettings falls back to the defaults when nothing usable is stored", () => {
	for (const stored of [undefined, null, "nonsense", 42, [], {}, { panels: "many" }, { panels: [] }, { panels: [7, null] }]) {
		assert.deepEqual(migrateSettings(stored), defaultSettings());
	}
});

test("migrateSettings turns the 1.2.1 shape into the default panel and keeps the status rules", () => {
	const migrated = migrateSettings({ filter: "all", showHeadings: true, closingStatuses: "listed", closingSymbols: "x, >" });

	assert.deepEqual(migrated, {
		...defaultSettings(),
		panels: [{ ...FOCUSED_PANEL, filter: "all", showHeadings: true }],
		closingStatuses: "listed",
		closingSymbols: "x, >",
	});
});

test("migrateSettings turns the focusedPanel shape into the default panel", () => {
	const migrated = migrateSettings({ focusedPanel: { filter: "closed", showHeadings: true }, notePanels: [] });

	assert.deepEqual(migrated.panels, [{ ...FOCUSED_PANEL, filter: "closed", showHeadings: true }]);
});

test("migrateSettings rejects a legacy filter that is not one of the three", () => {
	assert.deepEqual(migrateSettings({ filter: "archived" }), defaultSettings());
});

test("migrateSettings reads stored panels unchanged", () => {
	const panels = [
		{ ...FOCUSED_PANEL, filter: "all" },
		{
			id: "panel-1",
			name: "Work",
			icon: "briefcase",
			sources: [
				{ kind: "focused" },
				{ kind: "day" },
				{ kind: "week", custom: { folder: "weeks", format: "GGGG-[W]WW" } },
				{ kind: "note", path: "Projects/Beta.md" },
			],
			filter: "closed",
			showHeadings: true,
			showNoteHeaders: false,
		},
	];

	assert.deepEqual(migrateSettings({ panels }).panels, panels);
});

test("migrateSettings drops sources it does not know and defaults bad panel fields", () => {
	const [panel] = migrateSettings({
		panels: [
			{
				id: 7,
				name: "  ",
				icon: null,
				sources: [{ kind: "decade" }, { kind: "note" }, { kind: "note", path: " " }, "focused", { kind: "year", custom: "yes" }],
				filter: "archived",
				showHeadings: "yes",
				showNoteHeaders: "no",
			},
		],
	}).panels;

	assert.deepEqual(panel, {
		id: "panel-1",
		name: "Task overview",
		icon: "check-square",
		sources: [{ kind: "year" }],
		filter: "open",
		showHeadings: false,
		showNoteHeaders: true,
	});
});

test("migrateSettings gives panels sharing an id their own", () => {
	const ids = migrateSettings({ panels: [{ id: "default" }, { id: "default" }, { id: "panel-1" }] }).panels.map(({ id }) => id);

	assert.deepEqual(ids, ["default", "panel-1", "panel-2"]);
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

test("defaultSettings leaves no status out of the panel", () => {
	assert.equal(defaultSettings().hiddenStatuses, "none");
	assert.equal(defaultSettings().hiddenSymbols, "");
});

test("migrateSettings reads every hidden-status mode and the hidden characters", () => {
	for (const hiddenStatuses of ["none", "listed", "tasks-plugin"]) {
		assert.equal(migrateSettings({ hiddenStatuses }).hiddenStatuses, hiddenStatuses);
	}
	assert.equal(migrateSettings({ hiddenSymbols: "i, ?" }).hiddenSymbols, "i, ?");
});

test("migrateSettings falls back to hiding nothing for an unknown hidden mode or symbols", () => {
	const migrated = migrateSettings({ hiddenStatuses: "all", hiddenSymbols: ["i"] });
	assert.equal(migrated.hiddenStatuses, "none");
	assert.equal(migrated.hiddenSymbols, "");
});
