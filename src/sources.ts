import type { Period, PeriodicSource } from "./periodic.ts";
import type { Panel, Source } from "./settings";

export type NoteState = "found" | "not-created" | "missing";

export interface ResolvedNote {
	path: string;
	state: NoteState;
}

export interface ResolvedSources {
	notes: ResolvedNote[];
	unavailable: Period[];
}

export interface SourceContext {
	focusedPath: string | undefined;
	periodicPath(source: PeriodicSource): string | undefined;
	exists(path: string): boolean;
}

export function resolveSources(sources: readonly Source[], context: SourceContext): ResolvedSources {
	const notes = new Map<string, ResolvedNote>();
	const unavailable: Period[] = [];
	const keep = (path: string, absent: NoteState) => {
		if (!notes.has(path)) notes.set(path, { path, state: context.exists(path) ? "found" : absent });
	};

	for (const source of sources) {
		if (source.kind === "focused") {
			if (context.focusedPath && context.exists(context.focusedPath)) keep(context.focusedPath, "missing");
		} else if (source.kind === "note") {
			keep(source.path, "missing");
		} else {
			const path = context.periodicPath(source);
			if (path) keep(path, "not-created");
			else if (!unavailable.includes(source.kind)) unavailable.push(source.kind);
		}
	}

	return { notes: [...notes.values()], unavailable };
}

export function noteName(path: string): string {
	return path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
}

export function showsNoteHeaders(panel: Pick<Panel, "showNoteHeaders">, notes: readonly ResolvedNote[]): boolean {
	return panel.showNoteHeaders && notes.length >= 2;
}

export function panelTitle(panel: Pick<Panel, "name">, notes: readonly ResolvedNote[]): string {
	return notes.length === 1 ? noteName(notes[0].path) : panel.name;
}

export function followRename(panels: readonly Panel[], oldPath: string, newPath: string): boolean {
	let followed = false;
	for (const panel of panels) {
		for (const source of panel.sources) {
			if (source.kind !== "note" || source.path !== oldPath) continue;
			source.path = newPath;
			followed = true;
		}
	}
	return followed;
}
