import type { App } from "obsidian";
import type { ClosingStatuses, HiddenStatuses, TaskOverviewSettings } from "./settings";
import { isClosedStatus, readStatus } from "./tasks.ts";
import type { TaskStatus } from "./tasks.ts";

export type StatusReader = (statusChar: string) => TaskStatus;

export type MarkPredicate = (statusChar: string) => boolean;

export interface StatusRules {
	read: StatusReader;
	isHidden: MarkPredicate;
	followsTasksCycle: boolean;
}

export interface TasksStatusConfiguration {
	symbol: string;
	type: string;
}

const TASKS_PLUGIN_ID = "obsidian-tasks-plugin";
const TASKS_NON_TASK_TYPE = "NON_TASK";

const STATUS_BY_TASKS_TYPE: Record<string, TaskStatus> = {
	DONE: "done",
	CANCELLED: "cancelled",
	IN_PROGRESS: "in-progress",
};

export function parseSymbolList(typed: string): string[] {
	return typed
		.split(",")
		.map((symbol) => symbol.trim())
		.filter((symbol) => symbol.length > 0);
}

export function invalidSymbols(typed: string): string[] {
	return parseSymbolList(typed).filter((symbol) => [...symbol].length !== 1);
}

export function symbolListError(typed: string): string | undefined {
	const invalid = invalidSymbols(typed);
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
			const listed = new Set(parseSymbolList(closingSymbols));
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
		.flatMap((list): unknown[] => (Array.isArray(list) ? list : []))
		.filter(isStatusConfiguration);
	return statuses.length ? statuses : undefined;
}

interface PluginWithData {
	loadData?: () => Promise<unknown>;
}

interface PluginRegistry {
	plugins?: Record<string, PluginWithData | undefined>;
}

function loadedTasksPlugin(app: App): PluginWithData | undefined {
	return (app as App & { plugins?: PluginRegistry }).plugins?.plugins?.[TASKS_PLUGIN_ID];
}

export function isTasksPluginEnabled(app: App): boolean {
	return loadedTasksPlugin(app) !== undefined;
}

async function loadTasksStatusConfigurations(app: App): Promise<TasksStatusConfiguration[] | undefined> {
	const tasksPlugin = loadedTasksPlugin(app);
	if (typeof tasksPlugin?.loadData !== "function") return undefined;
	try {
		return readTasksStatusConfigurations(await tasksPlugin.loadData());
	} catch {
		return undefined;
	}
}

export function hiddenMarksFor(
	hiddenStatuses: HiddenStatuses,
	hiddenSymbols: string,
	tasksStatuses?: TasksStatusConfiguration[],
): MarkPredicate {
	switch (hiddenStatuses) {
		case "listed": {
			const listed = new Set(parseSymbolList(hiddenSymbols));
			return (statusChar) => listed.has(statusChar);
		}
		case "tasks-plugin": {
			const nonTasks = new Set(
				(tasksStatuses ?? []).filter(({ type }) => type === TASKS_NON_TASK_TYPE).map(({ symbol }) => symbol),
			);
			return (statusChar) => nonTasks.has(statusChar);
		}
		default:
			return () => false;
	}
}

export function statusRulesFor(
	settings: TaskOverviewSettings,
	tasksStatuses?: TasksStatusConfiguration[],
): StatusRules {
	return {
		read: statusReaderFor(settings.closingStatuses, settings.closingSymbols, tasksStatuses),
		isHidden: hiddenMarksFor(settings.hiddenStatuses, settings.hiddenSymbols, tasksStatuses),
		followsTasksCycle: settings.closingStatuses === "tasks-plugin",
	};
}

export const DEFAULT_STATUS_RULES: StatusRules = {
	read: readStatus,
	isHidden: () => false,
	followsTasksCycle: false,
};

export async function resolveStatusRules(app: App, settings: TaskOverviewSettings): Promise<StatusRules> {
	const followsTasks = settings.closingStatuses === "tasks-plugin" || settings.hiddenStatuses === "tasks-plugin";
	const tasksStatuses = followsTasks ? await loadTasksStatusConfigurations(app) : undefined;
	return statusRulesFor(settings, tasksStatuses);
}

function isStatusConfiguration(value: unknown): value is TasksStatusConfiguration {
	return isRecord(value) && typeof value.symbol === "string" && typeof value.type === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
