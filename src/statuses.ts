import type { App } from "obsidian";
import type { ClosingStatuses, TaskOverviewSettings } from "./settings";
import { isClosedStatus, readStatus } from "./tasks.ts";
import type { TaskStatus } from "./tasks.ts";

export type StatusReader = (statusChar: string) => TaskStatus;

export interface TasksStatusConfiguration {
	symbol: string;
	type: string;
}

const TASKS_PLUGIN_ID = "obsidian-tasks-plugin";

const STATUS_BY_TASKS_TYPE: Record<string, TaskStatus> = {
	DONE: "done",
	CANCELLED: "cancelled",
	IN_PROGRESS: "in-progress",
};

export function parseClosingSymbols(typed: string): string[] {
	return typed
		.split(",")
		.map((symbol) => symbol.trim())
		.filter((symbol) => symbol.length > 0);
}

export function invalidClosingSymbols(typed: string): string[] {
	return parseClosingSymbols(typed).filter((symbol) => [...symbol].length !== 1);
}

export function closingSymbolsError(typed: string): string | undefined {
	const invalid = invalidClosingSymbols(typed);
	if (!invalid.length) return undefined;
	return `Each entry must be a single character: ${invalid.join(", ")}`;
}

export function statusReaderClosedBy(isClosing: (statusChar: string) => boolean): StatusReader {
	return (statusChar) => {
		const status = readStatus(statusChar);
		if (isClosing(statusChar)) return isClosedStatus(status) ? status : "done";
		return isClosedStatus(status) ? "todo" : status;
	};
}

export function statusReaderFromTasksStatuses(statuses: TasksStatusConfiguration[]): StatusReader {
	const statusBySymbol = new Map<string, TaskStatus>();
	for (const { symbol, type } of statuses) {
		if (statusBySymbol.has(symbol)) continue;
		statusBySymbol.set(symbol, STATUS_BY_TASKS_TYPE[type] ?? "todo");
	}
	return (statusChar) => statusBySymbol.get(statusChar) ?? readStatus(statusChar);
}

export function statusReaderFor(
	closingStatuses: ClosingStatuses,
	closingSymbols: string,
	tasksStatuses?: TasksStatusConfiguration[],
): StatusReader {
	switch (closingStatuses) {
		case "any-mark":
			return statusReaderClosedBy((statusChar) => statusChar.trim().length > 0);
		case "listed": {
			const listed = new Set(parseClosingSymbols(closingSymbols));
			return statusReaderClosedBy((statusChar) => listed.has(statusChar));
		}
		case "tasks-plugin":
			return tasksStatuses ? statusReaderFromTasksStatuses(tasksStatuses) : readStatus;
		default:
			return readStatus;
	}
}

export function readTasksStatusConfigurations(stored: unknown): TasksStatusConfiguration[] | undefined {
	if (!isRecord(stored) || !isRecord(stored.statusSettings)) return undefined;
	const { coreStatuses, customStatuses } = stored.statusSettings;
	const statuses = [coreStatuses, customStatuses]
		.flatMap((list) => (Array.isArray(list) ? list : []))
		.filter(isStatusConfiguration);
	return statuses.length ? statuses : undefined;
}

interface PluginWithData {
	loadData?: () => Promise<unknown>;
}

interface PluginRegistry {
	plugins?: Record<string, PluginWithData | undefined>;
}

async function loadTasksStatusConfigurations(app: App): Promise<TasksStatusConfiguration[] | undefined> {
	const tasksPlugin = (app as App & { plugins?: PluginRegistry }).plugins?.plugins?.[TASKS_PLUGIN_ID];
	if (typeof tasksPlugin?.loadData !== "function") return undefined;
	try {
		return readTasksStatusConfigurations(await tasksPlugin.loadData());
	} catch {
		return undefined;
	}
}

export async function resolveStatusReader(app: App, settings: TaskOverviewSettings): Promise<StatusReader> {
	const tasksStatuses =
		settings.closingStatuses === "tasks-plugin" ? await loadTasksStatusConfigurations(app) : undefined;
	return statusReaderFor(settings.closingStatuses, settings.closingSymbols, tasksStatuses);
}

function isStatusConfiguration(value: unknown): value is TasksStatusConfiguration {
	return isRecord(value) && typeof value.symbol === "string" && typeof value.type === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
