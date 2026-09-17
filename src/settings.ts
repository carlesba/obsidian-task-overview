import type { TaskFilter } from "./tasks";

export interface TaskOverviewSettings {
	filter: TaskFilter;
	showHeadings: boolean;
}

const FILTERS: TaskFilter[] = ["open", "closed", "all"];

export function defaultSettings(): TaskOverviewSettings {
	return { filter: "open", showHeadings: false };
}

export function migrateSettings(stored: unknown): TaskOverviewSettings {
	const data = isRecord(stored) ? stored : {};
	const panel = isRecord(data.focusedPanel) ? data.focusedPanel : data;

	return { filter: readFilter(panel.filter), showHeadings: panel.showHeadings === true };
}

function readFilter(stored: unknown): TaskFilter {
	return FILTERS.find((filter) => filter === stored) ?? "open";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
