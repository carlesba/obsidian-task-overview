export const PERIODS = ["day", "week", "month", "quarter", "year"] as const;

export type Period = (typeof PERIODS)[number];

export interface PeriodLocation {
	folder: string;
	format: string;
}

export interface PeriodicSource {
	kind: Period;
	custom?: PeriodLocation;
}

export type PeriodProvider = "date-compass" | "periodic-notes" | "daily-notes";

export interface DetectedPeriod extends PeriodLocation {
	provider: PeriodProvider;
}

export interface PeriodicPlugins {
	dateCompassPeriods(): unknown;
	periodicNotesSettings(): unknown;
	dailyNotesOptions(): unknown;
}

export interface DateFormatter {
	format(format: string): string;
}

export const PROVIDER_NAMES: Record<PeriodProvider, string> = {
	"date-compass": "Date Compass",
	"periodic-notes": "Periodic Notes",
	"daily-notes": "Daily notes",
};

export const PERIOD_LABELS: Record<Period, string> = {
	day: "Today",
	week: "This week",
	month: "This month",
	quarter: "This quarter",
	year: "This year",
};

export const DEFAULT_FORMATS: Record<Period, string> = {
	day: "YYYY-MM-DD",
	week: "GGGG-[W]WW",
	month: "YYYY-MM",
	quarter: "YYYY-[Q]Q",
	year: "YYYY",
};

const PERIODIC_NOTES_KEYS: Record<Period, string> = {
	day: "daily",
	week: "weekly",
	month: "monthly",
	quarter: "quarterly",
	year: "yearly",
};

const PERIODIC_NOTES_DEFAULT_FORMATS: Record<Period, string> = { ...DEFAULT_FORMATS, week: "gggg-[W]ww" };

export function isPeriod(value: unknown): value is Period {
	return PERIODS.some((period) => period === value);
}

export function detectPeriod(period: Period, plugins: PeriodicPlugins): DetectedPeriod | undefined {
	return (
		enabledPeriod("date-compass", entryOf(plugins.dateCompassPeriods(), period), DEFAULT_FORMATS[period]) ??
		enabledPeriod(
			"periodic-notes",
			entryOf(plugins.periodicNotesSettings(), PERIODIC_NOTES_KEYS[period]),
			PERIODIC_NOTES_DEFAULT_FORMATS[period],
		) ??
		(period === "day" ? dailyNotes(plugins.dailyNotesOptions()) : undefined)
	);
}

export function periodLocation(source: PeriodicSource, plugins: PeriodicPlugins): PeriodLocation | undefined {
	if (!source.custom) return detectPeriod(source.kind, plugins);
	return {
		folder: normalizeFolder(source.custom.folder),
		format: formatOrDefault(source.custom.format, DEFAULT_FORMATS[source.kind]),
	};
}

export function customLocationFor(period: Period, plugins: PeriodicPlugins): PeriodLocation {
	const detected = detectPeriod(period, plugins);
	return { folder: detected?.folder ?? "", format: detected?.format ?? DEFAULT_FORMATS[period] };
}

export function periodicNotePath(
	location: PeriodLocation,
	today: DateFormatter,
	normalizePath: (path: string) => string,
): string {
	return normalizePath(`${location.folder}/${today.format(location.format)}.md`);
}

function entryOf(settings: unknown, key: string): unknown {
	return isRecord(settings) ? settings[key] : undefined;
}

function enabledPeriod(provider: PeriodProvider, entry: unknown, defaultFormat: string): DetectedPeriod | undefined {
	if (!isRecord(entry) || entry.enabled !== true) return undefined;
	return { provider, folder: normalizeFolder(entry.folder), format: formatOrDefault(entry.format, defaultFormat) };
}

function dailyNotes(options: unknown): DetectedPeriod | undefined {
	if (!isRecord(options)) return undefined;
	return {
		provider: "daily-notes",
		folder: normalizeFolder(options.folder),
		format: formatOrDefault(options.format, DEFAULT_FORMATS.day),
	};
}

function normalizeFolder(folder: unknown): string {
	return typeof folder === "string" ? folder.trim().replace(/^\/+|\/+$/g, "") : "";
}

function formatOrDefault(format: unknown, fallback: string): string {
	return typeof format === "string" && format.trim() !== "" ? format.trim() : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
