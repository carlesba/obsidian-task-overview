import { isPeriod } from "./periodic.ts";
import type { PeriodicSource } from "./periodic.ts";
import type { TaskFilter } from "./tasks";

export type ClosingStatuses = "done-and-cancelled" | "any-mark" | "listed" | "tasks-plugin";

export type HiddenStatuses = "none" | "listed" | "tasks-plugin";

export interface FocusedSource {
	kind: "focused";
}

export interface NoteSource {
	kind: "note";
	path: string;
}

export type Source = FocusedSource | PeriodicSource | NoteSource;

export interface Panel {
	id: string;
	name: string;
	icon: string;
	sources: Source[];
	filter: TaskFilter;
	showHeadings: boolean;
	showNoteHeaders: boolean;
}

export interface TaskOverviewSettings {
	panels: Panel[];
	closingStatuses: ClosingStatuses;
	closingSymbols: string;
	hiddenStatuses: HiddenStatuses;
	hiddenSymbols: string;
}

const FILTERS: TaskFilter[] = ["open", "closed", "all"];

export const CLOSING_STATUSES: ClosingStatuses[] = ["done-and-cancelled", "any-mark", "listed", "tasks-plugin"];

export const HIDDEN_STATUSES: HiddenStatuses[] = ["none", "listed", "tasks-plugin"];

export const DEFAULT_PANEL_ID = "default";

export const DEFAULT_PANEL_NAME = "Task overview";

export const DEFAULT_PANEL_ICON = "check-square";

export function defaultSettings(): TaskOverviewSettings {
	return migrateSettings(undefined);
}

export function migrateSettings(stored: unknown): TaskOverviewSettings {
	const data = isRecord(stored) ? stored : {};
	const panels = Array.isArray(data.panels) ? readPanels(data.panels) : [];

	return {
		panels: panels.length ? panels : [focusedPanel(isRecord(data.focusedPanel) ? data.focusedPanel : data)],
		closingStatuses: readClosingStatuses(data.closingStatuses),
		closingSymbols: readSymbols(data.closingSymbols),
		hiddenStatuses: readHiddenStatuses(data.hiddenStatuses),
		hiddenSymbols: readSymbols(data.hiddenSymbols),
	};
}

export function newPanel(panels: readonly Panel[], name: string, sources: Source[]): Panel {
	return {
		id: freePanelId(panels),
		name,
		icon: DEFAULT_PANEL_ICON,
		sources,
		filter: "open",
		showHeadings: false,
		showNoteHeaders: true,
	};
}

export function moveEntry(entries: unknown[], from: number, to: number): void {
	entries.splice(to, 0, ...entries.splice(from, 1));
}

export function readClosingStatuses(stored: unknown): ClosingStatuses {
	return CLOSING_STATUSES.find((closingStatuses) => closingStatuses === stored) ?? "done-and-cancelled";
}

export function readHiddenStatuses(stored: unknown): HiddenStatuses {
	return HIDDEN_STATUSES.find((hiddenStatuses) => hiddenStatuses === stored) ?? "none";
}

function focusedPanel(legacy: Record<string, unknown>): Panel {
	return {
		id: DEFAULT_PANEL_ID,
		name: DEFAULT_PANEL_NAME,
		icon: DEFAULT_PANEL_ICON,
		sources: [{ kind: "focused" }],
		filter: readFilter(legacy.filter),
		showHeadings: legacy.showHeadings === true,
		showNoteHeaders: true,
	};
}

function readPanels(stored: unknown[]): Panel[] {
	const panels: Panel[] = [];
	for (const entry of stored) {
		if (!isRecord(entry)) continue;
		panels.push({
			id: readPanelId(entry.id, panels),
			name: readText(entry.name, DEFAULT_PANEL_NAME),
			icon: readText(entry.icon, DEFAULT_PANEL_ICON),
			sources: Array.isArray(entry.sources) ? entry.sources.flatMap(readSource) : [],
			filter: readFilter(entry.filter),
			showHeadings: entry.showHeadings === true,
			showNoteHeaders: entry.showNoteHeaders !== false,
		});
	}
	return panels;
}

function readSource(stored: unknown): Source[] {
	if (!isRecord(stored)) return [];
	const { kind, path, custom } = stored;
	if (kind === "focused") return [{ kind }];
	if (kind === "note") return typeof path === "string" && path.trim() !== "" ? [{ kind, path }] : [];
	if (!isPeriod(kind)) return [];
	if (!isRecord(custom)) return [{ kind }];
	return [{ kind, custom: { folder: readText(custom.folder, ""), format: readText(custom.format, "") } }];
}

function readPanelId(stored: unknown, earlier: readonly Panel[]): string {
	const id = typeof stored === "string" ? stored.trim() : "";
	return id !== "" && !earlier.some((panel) => panel.id === id) ? id : freePanelId(earlier);
}

function freePanelId(panels: readonly Panel[]): string {
	for (let number = 1; ; number++) {
		const id = `panel-${number}`;
		if (!panels.some((panel) => panel.id === id)) return id;
	}
}

function readText(stored: unknown, fallback: string): string {
	return typeof stored === "string" && stored.trim() !== "" ? stored.trim() : fallback;
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
