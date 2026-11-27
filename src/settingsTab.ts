import { App, Notice, PluginSettingTab, Setting, moment, normalizePath, setIcon } from "obsidian";
import type TaskOverviewPlugin from "./main";
import { periodicPlugins } from "./obsidianPlugins";
import {
	DEFAULT_FORMATS,
	PERIODS,
	PERIOD_LABELS,
	PROVIDER_NAMES,
	customLocationFor,
	detectPeriod,
	periodLocation,
	periodicNotePath,
} from "./periodic";
import type { Period, PeriodicSource } from "./periodic";
import { Choice, IconPicker, NotePicker, showChoices } from "./pickers";
import {
	ClosingStatuses,
	HiddenStatuses,
	Panel,
	Source,
	TaskOverviewSettings,
	newPanel,
	readClosingStatuses,
	readHiddenStatuses,
} from "./settings";
import { ListRow, moveEntry, renderSettingsList } from "./settingsList";
import { noteName } from "./sources";
import { isTasksPluginEnabled, symbolListError } from "./statuses";

const HEADINGS_SETTING = {
	name: "Group tasks under their headings",
	desc: "Show each task beneath the heading it sits under instead of in one flat list.",
} as const;

const NOTE_HEADERS_SETTING = {
	name: "Show a header for each note",
	desc: "Name the note above its tasks when the panel lists two or more notes. Clicking the header opens the note.",
} as const;

const FOCUSED_SOURCE_NAME = "Focused note";

const FOCUSED_SOURCE_DESC = "The note in focus. Keeps the last note when focus moves to something that is not a note.";

const NO_SOURCES = "No sources yet";

const PERIOD_NOTES: Record<Period, string> = {
	day: "daily",
	week: "weekly",
	month: "monthly",
	quarter: "quarterly",
	year: "yearly",
};

const FOLLOW = "follow";

const CUSTOM = "custom";

const CLOSING_STATUSES_SETTING = {
	name: "Statuses that close a task",
	desc: "Closed tasks show as checked and appear under the closed filter instead of the open one. Following the Tasks plugin needs it installed and enabled.",
	options: {
		"done-and-cancelled": "Done [x] and cancelled [-]",
		"any-mark": "Any character inside the brackets",
		listed: "Only the characters I list",
		"tasks-plugin": "Follow the Tasks plugin",
	} satisfies Record<ClosingStatuses, string>,
} as const;

const CLOSING_SYMBOLS_SETTING = {
	key: "closingSymbols",
	name: "Characters that close a task",
	desc: "Comma-separated, for example: x, X, -, >",
	placeholder: "x, X, -",
} as const;

const TASKS_MISSING_NAME = "The Tasks plugin is not enabled";

const CLOSING_TASKS_MISSING_DESC =
	"Install and enable Tasks for this option to apply. Until then, only [x] and [-] close a task.";

const HIDDEN_TASKS_MISSING_DESC =
	"Install and enable Tasks for this option to apply. Until then, nothing is left out of the panel.";

const NOT_TASKS_HEADING = "List items that are not tasks";

const HIDDEN_STATUSES_SETTING = {
	name: "Statuses to leave out of the panel",
	desc: "Checkboxes with these marks are list items, such as [i] for information, so the panel neither lists nor counts them. Following the Tasks plugin hides the statuses it types as non-tasks, and needs it installed and enabled.",
	options: {
		none: "None",
		"tasks-plugin": "Follow the Tasks plugin",
		listed: "Only the characters I list",
	} satisfies Record<HiddenStatuses, string>,
} as const;

const HIDDEN_SYMBOLS_SETTING = {
	key: "hiddenSymbols",
	name: "Characters that are not tasks",
	desc: "Comma-separated, for example: i, ?",
	placeholder: "i",
} as const;

type SymbolsKey = typeof CLOSING_SYMBOLS_SETTING.key | typeof HIDDEN_SYMBOLS_SETTING.key;

export class TaskOverviewSettingTab extends PluginSettingTab {
	private plugin: TaskOverviewPlugin;
	private openPanelId: string | undefined;

	constructor(app: App, plugin: TaskOverviewPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		this.render();
	}

	private render(): void {
		const { containerEl } = this;
		const scrolled = containerEl.scrollTop;
		containerEl.empty();

		const panel = this.plugin.settings.panels.find(({ id }) => id === this.openPanelId);
		if (panel) this.displayPanel(panel);
		else this.displayMain();
		containerEl.scrollTop = scrolled;
	}

	hide(): void {
		this.openPanelId = undefined;
		super.hide();
	}

	private openPage(panelId: string | undefined): void {
		this.openPanelId = panelId;
		this.render();
		this.containerEl.scrollTop = 0;
	}

	private saveAndRender(): void {
		void this.plugin.saveSettings();
		this.render();
	}

	private displayMain(): void {
		const { containerEl } = this;
		const { settings } = this.plugin;
		const { panels } = settings;

		renderSettingsList({
			containerEl,
			heading: "Panels",
			addLabel: "Add a panel",
			emptyText: "No panels yet",
			rows: panels.map((panel) => ({
				name: panel.name,
				desc: panel.sources.map((source) => this.sourceName(source)).join(", ") || NO_SOURCES,
				editLabel: "Edit panel",
				onEdit: () => this.openPage(panel.id),
			})),
			onAdd: (anchor) =>
				showChoices(anchor, [
					{ title: "Panel for the focused note", pick: () => this.addPanel("Focused note", [{ kind: "focused" }]) },
					{ title: "Panel for today's note", pick: () => this.addPanel("Today", [{ kind: "day" }]) },
					{ title: "Empty panel", pick: () => this.addPanel("New panel", []) },
				]),
			onMove: (from, to) => {
				moveEntry(panels, from, to);
				this.saveAndRender();
			},
			onDelete: (index) => {
				if (panels.length === 1) {
					new Notice("Keep at least one panel.");
					return;
				}
				void this.plugin.deletePanel(panels[index]).then(() => this.render());
			},
		});

		new Setting(containerEl).setName("Task statuses").setHeading();

		this.addModeDropdown(CLOSING_STATUSES_SETTING, settings.closingStatuses, (value) => {
			settings.closingStatuses = readClosingStatuses(value);
		});
		if (settings.closingStatuses === "listed") this.addSymbolsField(CLOSING_SYMBOLS_SETTING);
		if (this.needsMissingTasks(settings.closingStatuses)) this.addTasksMissingNotice(CLOSING_TASKS_MISSING_DESC);

		new Setting(containerEl).setName(NOT_TASKS_HEADING).setHeading();

		this.addModeDropdown(HIDDEN_STATUSES_SETTING, settings.hiddenStatuses, (value) => {
			settings.hiddenStatuses = readHiddenStatuses(value);
		});
		if (settings.hiddenStatuses === "listed") this.addSymbolsField(HIDDEN_SYMBOLS_SETTING);
		if (this.needsMissingTasks(settings.hiddenStatuses)) this.addTasksMissingNotice(HIDDEN_TASKS_MISSING_DESC);
	}

	private addPanel(name: string, sources: Source[]): void {
		const { panels } = this.plugin.settings;
		const panel = newPanel(panels, name, sources);
		panels.push(panel);
		void this.plugin.saveSettings();
		this.openPage(panel.id);
	}

	private displayPanel(panel: Panel): void {
		const { containerEl } = this;

		const title = new Setting(containerEl).setName(panel.name).setHeading();
		title.settingEl.addClass("task-overview-settings-page-title");
		title.addButton((button) => button.setButtonText("Back to all panels").onClick(() => this.openPage(undefined)));

		const name = new Setting(containerEl).setName("Name").setDesc(this.panelNameDesc(panel));
		name.addText((text) =>
			text.setValue(panel.name).onChange((typed) => {
				const trimmed = typed.trim();
				if (trimmed === "") {
					name.setDesc("A panel needs a name.");
					return;
				}
				panel.name = trimmed;
				title.setName(trimmed);
				name.setDesc(this.panelNameDesc(panel));
				void this.plugin.saveSettings();
			}),
		);

		const icon = new Setting(containerEl).setName("Icon").setDesc("Shown on the panel's tab and next to its command.");
		setIcon(icon.controlEl.createSpan({ cls: "task-overview-icon-preview" }), panel.icon);
		icon.addButton((button) =>
			button.setButtonText("Choose icon").onClick(() =>
				new IconPicker(this.app, (picked) => {
					panel.icon = picked;
					this.saveAndRender();
				}).open(),
			),
		);

		this.displaySources(panel);

		new Setting(containerEl).setName("Layout").setHeading();
		this.addPanelToggle(HEADINGS_SETTING, panel.showHeadings, (value) => (panel.showHeadings = value));
		this.addPanelToggle(NOTE_HEADERS_SETTING, panel.showNoteHeaders, (value) => (panel.showNoteHeaders = value));
	}

	private panelNameDesc(panel: Panel): string {
		return `Names the tab and the command "Open ${panel.name}".`;
	}

	private addPanelToggle(definition: { name: string; desc: string }, value: boolean, change: (value: boolean) => void): void {
		new Setting(this.containerEl)
			.setName(definition.name)
			.setDesc(definition.desc)
			.addToggle((toggle) =>
				toggle.setValue(value).onChange((next) => {
					change(next);
					void this.plugin.saveSettings();
				}),
			);
	}

	private displaySources(panel: Panel): void {
		const { sources } = panel;
		renderSettingsList({
			containerEl: this.containerEl,
			heading: "Sources",
			addLabel: "Add a source",
			emptyText: NO_SOURCES,
			rows: sources.map((source) => this.sourceRow(source)),
			onAdd: (anchor) => showChoices(anchor, this.sourceChoices(sources)),
			onMove: (from, to) => {
				moveEntry(sources, from, to);
				this.saveAndRender();
			},
			onDelete: (index) => {
				sources.splice(index, 1);
				this.saveAndRender();
			},
		});
	}

	private sourceChoices(sources: Source[]): Choice[] {
		const add = (source: Source) => {
			sources.push(source);
			this.saveAndRender();
		};
		const listed = (kind: Source["kind"]) => sources.some((source) => source.kind === kind);
		return [
			...(listed("focused") ? [] : [{ title: FOCUSED_SOURCE_NAME, pick: () => add({ kind: "focused" }) }]),
			...PERIODS.filter((period) => !listed(period)).map((period) => ({
				title: PERIOD_LABELS[period],
				pick: () => add({ kind: period }),
			})),
			{
				title: "Note…",
				pick: () => new NotePicker(this.app, (note) => add({ kind: "note", path: note.path })).open(),
			},
		];
	}

	private sourceName(source: Source): string {
		if (source.kind === "focused") return FOCUSED_SOURCE_NAME;
		if (source.kind === "note") return noteName(source.path);
		return PERIOD_LABELS[source.kind];
	}

	private sourceRow(source: Source): ListRow {
		const name = this.sourceName(source);
		if (source.kind === "focused") return { name, desc: FOCUSED_SOURCE_DESC };
		if (source.kind === "note") {
			const missing = this.app.vault.getFileByPath(source.path) === null;
			return { name, desc: missing ? `${source.path} is missing from the vault.` : source.path };
		}
		return {
			name,
			desc: this.periodicDesc(source),
			addControls: (row) => this.addFollowControl(row, source),
			addDetails: (containerEl, row) => this.addPeriodicDetails(containerEl, row, source),
		};
	}

	private periodicDesc(source: PeriodicSource): string {
		const plugins = periodicPlugins(this.app);
		const location = periodLocation(source, plugins);
		const path = location && periodicNotePath(location, moment(), normalizePath);
		if (source.custom) return `Uses its own folder and format: ${path}`;
		const detected = detectPeriod(source.kind, plugins);
		if (!detected) return `Follows the plugin that provides ${PERIOD_NOTES[source.kind]} notes, and none does right now.`;
		return `Follows the folder and format of ${PROVIDER_NAMES[detected.provider]}: ${path}`;
	}

	private addFollowControl(row: Setting, source: PeriodicSource): void {
		const detected = detectPeriod(source.kind, periodicPlugins(this.app));
		row.addDropdown((dropdown) =>
			dropdown
				.addOption(FOLLOW, detected ? `Follow ${PROVIDER_NAMES[detected.provider]}` : "Follow a plugin")
				.addOption(CUSTOM, "Custom")
				.setValue(source.custom ? CUSTOM : FOLLOW)
				.onChange((mode) => {
					if (mode === CUSTOM) source.custom = customLocationFor(source.kind, periodicPlugins(this.app));
					else delete source.custom;
					this.saveAndRender();
				}),
		);
	}

	private addPeriodicDetails(containerEl: HTMLElement, row: Setting, source: PeriodicSource): void {
		const { custom } = source;
		const details = containerEl.createDiv({ cls: "task-overview-source-details" });
		if (!custom) {
			if (!detectPeriod(source.kind, periodicPlugins(this.app))) {
				new Setting(details)
					.setName(`No plugin provides ${PERIOD_NOTES[source.kind]} notes`)
					.setDesc(this.missingProviderDesc(source.kind));
			}
			return;
		}

		new Setting(details)
			.setName("Folder")
			.setDesc("Where these notes live. Leave empty for the vault root.")
			.addText((text) =>
				text.setValue(custom.folder).onChange((typed) => {
					custom.folder = typed;
					row.setDesc(this.periodicDesc(source));
					void this.plugin.saveSettings();
				}),
			);

		const format = new Setting(details).setName("Format").setDesc(this.formatDesc(source.kind, custom.format));
		format.addText((text) =>
			text
				.setPlaceholder(DEFAULT_FORMATS[source.kind])
				.setValue(custom.format)
				.onChange((typed) => {
					custom.format = typed;
					format.setDesc(this.formatDesc(source.kind, typed));
					row.setDesc(this.periodicDesc(source));
					void this.plugin.saveSettings();
				}),
		);
	}

	private formatDesc(period: Period, format: string): string {
		if (format.trim() === "") return `Empty, so ${DEFAULT_FORMATS[period]} is used.`;
		return `Today is ${moment().format(format.trim())}`;
	}

	private missingProviderDesc(period: Period): string {
		const providers =
			period === "day"
				? "Date Compass, Periodic Notes or the core Daily notes plugin"
				: `Date Compass or Periodic Notes with ${PERIOD_NOTES[period]} notes turned on`;
		return `Enable ${providers}, or switch this source to Custom. Until then it lists nothing.`;
	}

	private needsMissingTasks(mode: ClosingStatuses | HiddenStatuses): boolean {
		return mode === "tasks-plugin" && !isTasksPluginEnabled(this.app);
	}

	private addTasksMissingNotice(desc: string): void {
		new Setting(this.containerEl).setName(TASKS_MISSING_NAME).setDesc(desc);
	}

	private addModeDropdown(
		definition: { name: string; desc: string; options: Record<string, string> },
		selected: string,
		select: (value: string) => void,
	): void {
		new Setting(this.containerEl)
			.setName(definition.name)
			.setDesc(definition.desc)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(definition.options)
					.setValue(selected)
					.onChange((value) => {
						select(value);
						this.saveAndRender();
					}),
			);
	}

	private addSymbolsField(definition: { key: SymbolsKey; name: string; desc: string; placeholder: string }): void {
		const settings: TaskOverviewSettings = this.plugin.settings;
		const field = new Setting(this.containerEl).setName(definition.name).setDesc(definition.desc);
		field.addText((text) =>
			text
				.setPlaceholder(definition.placeholder)
				.setValue(settings[definition.key])
				.onChange((value) => {
					const error = symbolListError(value);
					field.setDesc(error ?? definition.desc);
					if (error) return;
					settings[definition.key] = value;
					void this.plugin.saveSettings();
				}),
		);
	}
}
