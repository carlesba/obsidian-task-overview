import { AbstractInputSuggest, App, Notice, PluginSettingTab, Setting, TFile } from "obsidian";
import type TaskOverviewPlugin from "./main";
import { TaskFilter } from "./tasks";

export interface PanelSettings {
	filter: TaskFilter;
	showHeadings: boolean;
}

export interface NotePanelSettings extends PanelSettings {
	path: string;
}

export interface TaskOverviewSettings {
	focusedPanel: PanelSettings;
	notePanels: NotePanelSettings[];
}

const FILTERS: TaskFilter[] = ["open", "closed", "all"];

export function defaultPanelSettings(): PanelSettings {
	return { filter: "open", showHeadings: false };
}

export function defaultSettings(): TaskOverviewSettings {
	return { focusedPanel: defaultPanelSettings(), notePanels: [] };
}

export function noteBasename(path: string): string {
	const name = path.split("/").pop() ?? path;
	return name.replace(/\.md$/i, "");
}

interface StoredSettings {
	filter?: unknown;
	focusedPanel?: unknown;
	notePanels?: unknown;
}

export function migrateSettings(stored: unknown): TaskOverviewSettings {
	const data: StoredSettings = isRecord(stored) ? stored : {};
	const focusedPanel = isRecord(data.focusedPanel)
		? readPanel(data.focusedPanel)
		: { filter: readFilter(data.filter), showHeadings: false };

	const notePanels: NotePanelSettings[] = [];
	if (Array.isArray(data.notePanels)) {
		for (const entry of data.notePanels) {
			if (!isRecord(entry)) continue;
			const path = typeof entry.path === "string" ? entry.path : "";
			if (!path || notePanels.some((panel) => panel.path === path)) continue;
			notePanels.push({ ...readPanel(entry), path });
		}
	}

	return { focusedPanel, notePanels };
}

function readPanel(stored: Record<string, unknown>): PanelSettings {
	return { filter: readFilter(stored.filter), showHeadings: stored.showHeadings === true };
}

function readFilter(stored: unknown): TaskFilter {
	return FILTERS.find((filter) => filter === stored) ?? "open";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

class MarkdownFileSuggest extends AbstractInputSuggest<TFile> {
	private onPick: (file: TFile) => void;

	constructor(app: App, inputEl: HTMLInputElement, onPick: (file: TFile) => void) {
		super(app, inputEl);
		this.onPick = onPick;
	}

	protected getSuggestions(query: string): TFile[] {
		const needle = query.toLowerCase();
		return this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path.toLowerCase().includes(needle))
			.slice(0, 20);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(file: TFile): void {
		this.setValue(file.path);
		this.onPick(file);
		this.close();
	}
}

export class TaskOverviewSettingTab extends PluginSettingTab {
	private plugin: TaskOverviewPlugin;
	private pendingPath = "";

	constructor(app: App, plugin: TaskOverviewPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Panel following the active note").setHeading();

		new Setting(containerEl)
			.setName("Group tasks under their headings")
			.setDesc("Show each task beneath the heading it sits under instead of in one flat list.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.focusedPanel.showHeadings)
					.onChange((value) => {
						this.plugin.settings.focusedPanel.showHeadings = value;
						void this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName("Panels pinned to a note").setHeading();

		if (!this.plugin.settings.notePanels.length) {
			new Setting(containerEl).setDesc(
				"Add a note to get a panel that always lists that note's tasks, with its own command.",
			);
		}

		for (const panel of this.plugin.settings.notePanels) {
			new Setting(containerEl)
				.setName(noteBasename(panel.path))
				.setDesc(panel.path)
				.addToggle((toggle) =>
					toggle
						.setTooltip("Group tasks under their headings")
						.setValue(panel.showHeadings)
						.onChange((value) => {
							panel.showHeadings = value;
							void this.plugin.saveSettings();
						}),
				)
				.addButton((button) =>
					button
						.setButtonText("Remove")
						.setWarning()
						.onClick(() => {
							this.plugin.settings.notePanels = this.plugin.settings.notePanels.filter(
								(entry) => entry !== panel,
							);
							void this.plugin.saveSettings().then(() => this.display());
						}),
				);
		}

		this.pendingPath = "";
		new Setting(containerEl)
			.setName("Add note panel")
			.addText((text) => {
				text.setPlaceholder("Type to search notes").onChange((value) => {
					this.pendingPath = value;
				});
				new MarkdownFileSuggest(this.app, text.inputEl, (file) => {
					this.pendingPath = file.path;
				});
			})
			.addButton((button) =>
				button
					.setButtonText("Add")
					.setCta()
					.onClick(() => void this.addPendingPanel()),
			);
	}

	private async addPendingPanel(): Promise<void> {
		const file = this.app.vault.getFileByPath(this.pendingPath);
		if (!file || file.extension !== "md") {
			new Notice("Pick a note from the list of suggestions.");
			return;
		}
		if (this.plugin.settings.notePanels.some((panel) => panel.path === file.path)) return;

		this.plugin.settings.notePanels.push({ ...defaultPanelSettings(), path: file.path });
		await this.plugin.saveSettings();
		this.display();
	}
}
