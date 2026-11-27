import { test } from "node:test";
import { strict as assert } from "node:assert";
import { migrateSettings } from "../src/settings.ts";
import type { Source } from "../src/settings.ts";
import { followRename, panelTitle, resolveSources, showsNoteHeaders } from "../src/sources.ts";
import type { SourceContext } from "../src/sources.ts";

const PERIODIC_PATHS: Record<string, string | undefined> = {
	day: "journal/2025-06-04.md",
	week: "2025-W23.md",
	month: undefined,
};

function vaultWith(existing: string[], focusedPath?: string): SourceContext {
	return {
		focusedPath,
		periodicPath: (source) => PERIODIC_PATHS[source.kind],
		exists: (path) => existing.includes(path),
	};
}

const SOURCES: Source[] = [
	{ kind: "focused" },
	{ kind: "day" },
	{ kind: "week" },
	{ kind: "note", path: "Projects/Beta.md" },
];

const EVERY_NOTE = ["Alpha.md", "journal/2025-06-04.md", "2025-W23.md", "Projects/Beta.md"];

test("sources resolve to their notes in list order", () => {
	const { notes } = resolveSources(SOURCES, vaultWith(EVERY_NOTE, "Alpha.md"));

	assert.deepEqual(notes, [
		{ path: "Alpha.md", state: "found" },
		{ path: "journal/2025-06-04.md", state: "found" },
		{ path: "2025-W23.md", state: "found" },
		{ path: "Projects/Beta.md", state: "found" },
	]);
});

test("a note reached by several sources is listed once, where the first source put it", () => {
	const sources: Source[] = [{ kind: "note", path: "Projects/Beta.md" }, ...SOURCES, { kind: "day" }];
	const { notes } = resolveSources(sources, vaultWith(EVERY_NOTE, "journal/2025-06-04.md"));

	assert.deepEqual(
		notes.map(({ path }) => path),
		["Projects/Beta.md", "journal/2025-06-04.md", "2025-W23.md"],
	);
});

test("a periodic note not created yet and a deleted note are kept as absent", () => {
	const { notes } = resolveSources(SOURCES, vaultWith(["Alpha.md"], "Alpha.md"));

	assert.deepEqual(notes.slice(1), [
		{ path: "journal/2025-06-04.md", state: "not-created" },
		{ path: "2025-W23.md", state: "not-created" },
		{ path: "Projects/Beta.md", state: "missing" },
	]);
});

test("the focused source adds nothing while no note is in focus or after that note is deleted", () => {
	assert.deepEqual(resolveSources([{ kind: "focused" }], vaultWith(EVERY_NOTE)).notes, []);
	assert.deepEqual(resolveSources([{ kind: "focused" }], vaultWith([], "Alpha.md")).notes, []);
});

test("a periodic source no plugin provides is reported instead of resolved", () => {
	const resolved = resolveSources([{ kind: "month" }, { kind: "day" }, { kind: "month" }], vaultWith(EVERY_NOTE));

	assert.deepEqual(resolved.unavailable, ["month"]);
	assert.deepEqual(resolved.notes, [{ path: "journal/2025-06-04.md", state: "found" }]);
});

test("note headers show only when turned on and two or more notes resolve", () => {
	const { notes } = resolveSources(SOURCES, vaultWith(EVERY_NOTE, "Alpha.md"));
	const sameNoteTwice = resolveSources([{ kind: "focused" }, { kind: "day" }], vaultWith(EVERY_NOTE, "journal/2025-06-04.md")).notes;

	assert.equal(showsNoteHeaders({ showNoteHeaders: true }, notes), true);
	assert.equal(showsNoteHeaders({ showNoteHeaders: false }, notes), false);
	assert.equal(showsNoteHeaders({ showNoteHeaders: true }, sameNoteTwice), false);
	assert.equal(showsNoteHeaders({ showNoteHeaders: true }, []), false);
});

test("the panel is titled after its only note, and by its own name otherwise", () => {
	const panel = { name: "Work" };
	const { notes } = resolveSources(SOURCES, vaultWith(EVERY_NOTE, "Alpha.md"));

	assert.equal(panelTitle(panel, [{ path: "Projects/Beta.md", state: "found" }]), "Beta");
	assert.equal(panelTitle(panel, notes), "Work");
	assert.equal(panelTitle(panel, []), "Work");
});

test("a renamed note stays a source under its new path in every panel", () => {
	const { panels } = migrateSettings({
		panels: [
			{ id: "default", sources: [{ kind: "focused" }, { kind: "note", path: "Renamed later.md" }] },
			{ id: "work", sources: [{ kind: "note", path: "Renamed later.md" }, { kind: "note", path: "Projects/Beta.md" }] },
		],
	});

	assert.equal(followRename(panels, "Renamed later.md", "Archive/Renamed.md"), true);
	assert.deepEqual(panels[0].sources, [{ kind: "focused" }, { kind: "note", path: "Archive/Renamed.md" }]);
	assert.deepEqual(panels[1].sources, [
		{ kind: "note", path: "Archive/Renamed.md" },
		{ kind: "note", path: "Projects/Beta.md" },
	]);
});

test("renaming a note that is not a source changes nothing", () => {
	const { panels } = migrateSettings({ panels: [{ id: "default", sources: [{ kind: "note", path: "Projects/Beta.md" }] }] });

	assert.equal(followRename(panels, "Alpha.md", "Gamma.md"), false);
	assert.deepEqual(panels[0].sources, [{ kind: "note", path: "Projects/Beta.md" }]);
});
