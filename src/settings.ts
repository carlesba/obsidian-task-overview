import type { TaskFilter } from "./tasks";

export type ClosingStatuses = "done-and-cancelled" | "any-mark" | "listed" | "tasks-plugin";

export type HiddenStatuses = "none" | "listed" | "tasks-plugin";

export interface TaskOverviewSettings {
	filter: TaskFilter;
	showHeadings: boolean;
	closingStatuses: ClosingStatuses;
	closingSymbols: string;
	hiddenStatuses: HiddenStatuses;
	hiddenSymbols: string;
}

const FILTERS: TaskFilter[] = ["open", "closed", "all"];

export const CLOSING_STATUSES: ClosingStatuses[] = ["done-and-cancelled", "any-mark", "listed", "tasks-plugin"];

export const HIDDEN_STATUSES: HiddenStatuses[] = ["none", "listed", "tasks-plugin"];

export function defaultSettings(): TaskOverviewSettings {
	return {
		filter: "open",
		showHeadings: false,
		closingStatuses: "done-and-cancelled",
		closingSymbols: "",
		hiddenStatuses: "none",
		hiddenSymbols: "",
	};
}

export function migrateSettings(stored: unknown): TaskOverviewSettings {
	const data = isRecord(stored) ? stored : {};
	const panel = isRecord(data.focusedPanel) ? data.focusedPanel : data;

	return {
		filter: readFilter(panel.filter),
		showHeadings: panel.showHeadings === true,
		closingStatuses: readClosingStatuses(data.closingStatuses),
		closingSymbols: readSymbols(data.closingSymbols),
		hiddenStatuses: readHiddenStatuses(data.hiddenStatuses),
		hiddenSymbols: readSymbols(data.hiddenSymbols),
	};
}

export function readClosingStatuses(stored: unknown): ClosingStatuses {
	return CLOSING_STATUSES.find((closingStatuses) => closingStatuses === stored) ?? "done-and-cancelled";
}

export function readHiddenStatuses(stored: unknown): HiddenStatuses {
	return HIDDEN_STATUSES.find((hiddenStatuses) => hiddenStatuses === stored) ?? "none";
}

function readSymbols(stored: unknown): string {
	return typeof stored === "string" ? stored : "";
}

function readFilter(stored: unknown): TaskFilter {
	return FILTERS.find((filter) => filter === stored) ?? "open";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
