import type { App } from "obsidian";
import type { PeriodicPlugins } from "./periodic";

interface PluginRegistries {
	plugins?: {
		getPlugin(id: string): { settings?: unknown; api?: { periods?: () => unknown } } | null | undefined;
	};
	internalPlugins?: {
		getPluginById(id: string): { enabled?: boolean; instance?: { options?: unknown } } | null | undefined;
	};
}

export function periodicPlugins(app: App): PeriodicPlugins {
	const registries = app as App & PluginRegistries;
	return {
		dateCompassPeriods: () => readSafely(() => registries.plugins?.getPlugin("date-compass")?.api?.periods?.()),
		periodicNotesSettings: () => readSafely(() => registries.plugins?.getPlugin("periodic-notes")?.settings),
		dailyNotesOptions: () =>
			readSafely(() => {
				const dailyNotes = registries.internalPlugins?.getPluginById("daily-notes");
				return dailyNotes?.enabled ? dailyNotes.instance?.options : undefined;
			}),
	};
}

function readSafely<T>(read: () => T): T | undefined {
	try {
		return read();
	} catch {
		return undefined;
	}
}
