import { test } from "node:test";
import { strict as assert } from "node:assert";
import moment from "moment";
import type { App } from "obsidian";
import { periodicPlugins } from "../src/obsidianPlugins.ts";
import { customLocationFor, detectPeriod, periodLocation, periodicNotePath } from "../src/periodic.ts";
import type { PeriodicSource } from "../src/periodic.ts";

const TODAY = moment("2025-06-04");

interface Installed {
	dateCompass?: Record<string, unknown>;
	periodicNotes?: Record<string, unknown>;
	dailyNotes?: { enabled: boolean; options?: Record<string, unknown> };
}

function vaultWith({ dateCompass, periodicNotes, dailyNotes }: Installed) {
	const communityPlugins: Record<string, unknown> = {
		"date-compass": dateCompass && { api: { periods: () => dateCompass } },
		"periodic-notes": periodicNotes && { settings: periodicNotes },
	};
	const app = {
		plugins: { getPlugin: (id: string) => communityPlugins[id] ?? null },
		internalPlugins: {
			getPluginById: (id: string) =>
				id === "daily-notes" && dailyNotes ? { enabled: dailyNotes.enabled, instance: { options: dailyNotes.options } } : null,
		},
	};
	return periodicPlugins(app as unknown as App);
}

function normalizePath(path: string): string {
	return path.replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}

function pathOf(source: PeriodicSource, installed: Installed): string | undefined {
	const location = periodLocation(source, vaultWith(installed));
	return location && periodicNotePath(location, TODAY, normalizePath);
}

const DATE_COMPASS = {
	day: { enabled: true, folder: "journal", format: "YYYY-MM-DD" },
	week: { enabled: true, folder: "", format: "GGGG-[W]WW" },
	month: { enabled: false, folder: "months", format: "YYYY-MM" },
	quarter: { enabled: true, folder: "/quarters/", format: "" },
	year: { enabled: true, folder: "years", format: "YYYY" },
};

const PERIODIC_NOTES = {
	daily: { enabled: true, folder: "pn/days", format: "DD-MM-YYYY" },
	weekly: { enabled: true, folder: "pn/weeks", format: "" },
	monthly: { enabled: true, folder: "pn/months", format: "YYYY-MM" },
	quarterly: { enabled: false, folder: "pn/quarters", format: "YYYY-[Q]Q" },
};

const DAILY_NOTES = { enabled: true, options: { folder: "daily", format: "" } };

test("a followed source resolves in Date Compass's folder and format for every period", () => {
	const installed = { dateCompass: DATE_COMPASS, periodicNotes: PERIODIC_NOTES, dailyNotes: DAILY_NOTES };

	assert.equal(pathOf({ kind: "day" }, installed), "journal/2025-06-04.md");
	assert.equal(pathOf({ kind: "week" }, installed), "2025-W23.md");
	assert.equal(pathOf({ kind: "quarter" }, installed), "quarters/2025-Q2.md");
	assert.equal(pathOf({ kind: "year" }, installed), "years/2025.md");
});

test("a period Date Compass has turned off falls through to Periodic Notes", () => {
	const installed = { dateCompass: DATE_COMPASS, periodicNotes: PERIODIC_NOTES };

	assert.equal(pathOf({ kind: "month" }, installed), "pn/months/2025-06.md");
	assert.equal(detectPeriod("month", vaultWith(installed))?.provider, "periodic-notes");
});

test("without Date Compass a followed source resolves from Periodic Notes", () => {
	const installed = { periodicNotes: PERIODIC_NOTES, dailyNotes: DAILY_NOTES };

	assert.equal(pathOf({ kind: "day" }, installed), "pn/days/04-06-2025.md");
	assert.equal(pathOf({ kind: "week" }, installed), `pn/weeks/${TODAY.format("gggg-[W]ww")}.md`);
});

test("core Daily notes provides the day only, and only while enabled", () => {
	assert.equal(pathOf({ kind: "day" }, { dailyNotes: DAILY_NOTES }), "daily/2025-06-04.md");
	assert.equal(pathOf({ kind: "week" }, { dailyNotes: DAILY_NOTES }), undefined);
	assert.equal(pathOf({ kind: "day" }, { dailyNotes: { ...DAILY_NOTES, enabled: false } }), undefined);
});

test("a followed source resolves to nothing when no plugin provides its period", () => {
	assert.equal(pathOf({ kind: "day" }, {}), undefined);
	assert.equal(pathOf({ kind: "quarter" }, { periodicNotes: PERIODIC_NOTES }), undefined);
	assert.equal(pathOf({ kind: "year" }, { periodicNotes: PERIODIC_NOTES }), undefined);
});

test("a custom source uses its own folder and format whatever is installed", () => {
	const source: PeriodicSource = { kind: "week", custom: { folder: "/weeks/", format: "GGGG/[W]WW" } };

	assert.equal(pathOf(source, { dateCompass: DATE_COMPASS }), "weeks/2025/W23.md");
	assert.equal(pathOf(source, {}), "weeks/2025/W23.md");
});

test("a custom source with an empty format uses the period's default format", () => {
	assert.equal(pathOf({ kind: "month", custom: { folder: "", format: " " } }, {}), "2025-06.md");
});

test("switching to custom starts from the values of the plugin being followed", () => {
	assert.deepEqual(customLocationFor("day", vaultWith({ dateCompass: DATE_COMPASS })), {
		folder: "journal",
		format: "YYYY-MM-DD",
	});
	assert.deepEqual(customLocationFor("week", vaultWith({})), { folder: "", format: "GGGG-[W]WW" });
});

test("a plugin whose settings cannot be read is skipped", () => {
	const app = {
		plugins: {
			getPlugin: () => {
				throw new Error("not ready");
			},
		},
	};

	assert.equal(detectPeriod("day", periodicPlugins(app as unknown as App)), undefined);
});
