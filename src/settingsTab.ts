import { App, Notice, PluginSettingTab, Setting, moment, normalizePath, setIcon } from "obsidian";
import type {
	SettingDefinition,
	SettingDefinitionGroup,
	SettingDefinitionItem,
	SettingDefinitionList,
	SettingDefinitionPage,
} from "obsidian";
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
import type { Period, PeriodLocation, PeriodicSource } from "./periodic";
import { Choice, IconPicker, NotePicker, showChoices } from "./pickers";
import {
	ClosingStatuses,
	HiddenStatuses,
	Panel,
	Source,
	moveEntry,
	newPanel,
	readClosingStatuses,
	readHiddenStatuses,
} from "./settings";
import { noteName } from "./sources";
import { isTasksPluginEnabled, symbolListError } from "./statuses";

const PANEL_NAME_SETTING = {
	name: "Name",
	desc: "Names the panel's tab and the command that opens it.",
	empty: "A panel needs a name.",
} as const;

const ICON_SETTING = {
	name: "Icon",
	desc: "Shown on the panel's tab and next to its command.",
} as const;

const POSITION_SETTING = {
	name: "Position in the panel list",
	desc: "The ribbon icon opens the first panel.",
} as const;

const REMOVE_SETTING = {
	name: "Remove this panel",
	desc: "Closes the panel's tab and removes its command.",
	lastPanel: "Keep at least one panel.",
} as const;

const REMOVED_PANEL = {
	name: "This panel was removed",
	desc: "Go back to see the panels that are left.",
} as const;

const FOLDER_SETTING = {
	name: "Folder",
	desc: "Where these notes live. Leave empty for the vault root.",
} as const;

const FORMAT_SETTING = {
	name: "Format",
	desc: "The Moment.js format of the note's name. Shows today's date in that format as you type.",
} as const;

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
	name: "Characters that are not tasks",
	desc: "Comma-separated, for example: i, ?",
	placeholder: "i",
} as const;

interface Binding {
	read: () => unknown;
	write: (value: unknown) => void;
}

interface RemovedPanel {
	id: string;
	name: string;
}

export class TaskOverviewSettingTab extends PluginSettingTab {
	private plugin: TaskOverviewPlugin;
	private bindings = new Map<string, Binding>();
	private sourceRows = new WeakMap<Source, Setting>();
	private removedPanels: RemovedPanel[] = [];

	constructor(app: App, plugin: TaskOverviewPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		this.bindings.clear();
		const { settings } = this.plugin;
		return [
			this.panelList(),
			...this.removedPanelPages(),
			{
				type: "group",
				id: "closing-statuses",
				heading: "Task statuses",
				items: [
					this.modeDropdown("closingStatuses", CLOSING_STATUSES_SETTING, {
						read: () => settings.closingStatuses,
						write: (value) => (settings.closingStatuses = readClosingStatuses(value)),
					}),
					this.symbolsField("closingSymbols", CLOSING_SYMBOLS_SETTING, () => settings.closingStatuses === "listed", {
						read: () => settings.closingSymbols,
						write: (value) => (settings.closingSymbols = readText(value)),
					}),
					this.tasksMissingNotice("closing-tasks-missing", CLOSING_TASKS_MISSING_DESC, () => settings.closingStatuses),
				],
			},
			{
				type: "group",
				id: "hidden-statuses",
				heading: NOT_TASKS_HEADING,
				items: [
					this.modeDropdown("hiddenStatuses", HIDDEN_STATUSES_SETTING, {
						read: () => settings.hiddenStatuses,
						write: (value) => (settings.hiddenStatuses = readHiddenStatuses(value)),
					}),
					this.symbolsField("hiddenSymbols", HIDDEN_SYMBOLS_SETTING, () => settings.hiddenStatuses === "listed", {
						read: () => settings.hiddenSymbols,
						write: (value) => (settings.hiddenSymbols = readText(value)),
					}),
					this.tasksMissingNotice("hidden-tasks-missing", HIDDEN_TASKS_MISSING_DESC, () => settings.hiddenStatuses),
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		return this.bindings.get(key)?.read();
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const binding = this.bindings.get(key);
		if (!binding) return;
		binding.write(value);
		await this.plugin.saveSettings();
	}

	hide(): void {
		this.removedPanels = [];
		super.hide();
	}

	private bind(key: string, binding: Binding): string {
		this.bindings.set(key, binding);
		return key;
	}

	private save(): void {
		void this.plugin.saveSettings();
	}

	private panelList(): SettingDefinitionList {
		const { panels } = this.plugin.settings;
		return {
			type: "list",
			id: "panels",
			heading: "Panels",
			emptyState: "No panels yet",
			addItem: {
				name: "Add a panel",
				action: (anchor) =>
					showChoices(anchor, [
						{ title: "Panel for the focused note", pick: () => this.addPanel("Focused note", [{ kind: "focused" }]) },
						{ title: "Panel for today's note", pick: () => this.addPanel("Today", [{ kind: "day" }]) },
						{ title: "Empty panel", pick: () => this.addPanel("New panel", []) },
					]),
			},
			onReorder: (from, to) => this.movePanel(from, to),
			onDelete: (index) => this.removePanel(panels[index]),
			items: panels.map((panel) => this.panelPage(panel)),
		};
	}

	private addPanel(name: string, sources: Source[]): void {
		const { panels } = this.plugin.settings;
		panels.push(newPanel(panels, name, sources));
		this.save();
	}

	private movePanel(from: number, to: number): void {
		moveEntry(this.plugin.settings.panels, from, to);
		this.save();
	}

	private removePanel(panel: Panel | undefined): void {
		if (!panel) return;
		if (this.plugin.settings.panels.length === 1) {
			new Notice(REMOVE_SETTING.lastPanel);
			return;
		}
		this.removedPanels.push({ id: panel.id, name: panel.name });
		void this.plugin.deletePanel(panel);
	}

	private removedPanelPages(): SettingDefinitionPage[] {
		const { panels } = this.plugin.settings;
		return this.removedPanels
			.filter((removed, index, all) => all.findIndex(({ id }) => id === removed.id) === index)
			.filter((removed) => !panels.some(({ id }) => id === removed.id))
			.map((removed) => ({
				type: "page",
				id: removed.id,
				name: removed.name,
				visible: false,
				items: [{ id: "removed", name: REMOVED_PANEL.name, desc: REMOVED_PANEL.desc, searchable: false }],
			}));
	}

	private panelPage(panel: Panel): SettingDefinitionPage {
		const key = (setting: string) => `panel:${panel.id}:${setting}`;
		return {
			type: "page",
			id: panel.id,
			name: panel.name,
			desc: panel.sources.map((source) => this.sourceName(source)).join(", ") || NO_SOURCES,
			items: [
				{
					id: "name",
					name: PANEL_NAME_SETTING.name,
					desc: PANEL_NAME_SETTING.desc,
					control: {
						type: "text",
						key: this.bind(key("name"), {
							read: () => panel.name,
							write: (value) => (panel.name = readText(value).trim() || panel.name),
						}),
						validate: (typed) => (typed.trim() === "" ? PANEL_NAME_SETTING.empty : undefined),
					},
				},
				{
					id: "icon",
					name: ICON_SETTING.name,
					desc: ICON_SETTING.desc,
					render: (setting) => this.renderIconPicker(setting, panel),
				},
				this.sourceList(panel),
				...this.periodicDetails(panel, key),
				{
					type: "group",
					id: "layout",
					heading: "Layout",
					items: [
						{
							id: "headings",
							name: HEADINGS_SETTING.name,
							desc: HEADINGS_SETTING.desc,
							control: {
								type: "toggle",
								key: this.bind(key("showHeadings"), {
									read: () => panel.showHeadings,
									write: (value) => (panel.showHeadings = value === true),
								}),
							},
						},
						{
							id: "note-headers",
							name: NOTE_HEADERS_SETTING.name,
							desc: NOTE_HEADERS_SETTING.desc,
							control: {
								type: "toggle",
								key: this.bind(key("showNoteHeaders"), {
									read: () => panel.showNoteHeaders,
									write: (value) => (panel.showNoteHeaders = value === true),
								}),
							},
						},
					],
				},
				{
					type: "group",
					id: "panel-list",
					heading: "Panel list",
					items: [
						{
							id: "position",
							name: POSITION_SETTING.name,
							desc: POSITION_SETTING.desc,
							render: (setting) => this.renderPosition(setting, panel),
						},
						{
							id: "remove",
							name: REMOVE_SETTING.name,
							desc: REMOVE_SETTING.desc,
							render: (setting) => this.renderRemove(setting, panel),
						},
					],
				},
			],
		};
	}

	private renderIconPicker(setting: Setting, panel: Panel): void {
		setIcon(setting.controlEl.createSpan({ cls: "task-overview-icon-preview" }), panel.icon);
		setting.addButton((button) =>
			button.setButtonText("Choose icon").onClick(() =>
				new IconPicker(this.app, (picked) => {
					panel.icon = picked;
					this.save();
				}).open(),
			),
		);
	}

	private renderPosition(setting: Setting, panel: Panel): void {
		const { panels } = this.plugin.settings;
		const index = panels.indexOf(panel);
		setting.setDesc(`Panel ${index + 1} of ${panels.length}. ${POSITION_SETTING.desc}`);
		setting.addButton((button) =>
			button
				.setButtonText("Move up")
				.setDisabled(index <= 0)
				.onClick(() => this.movePanel(index, index - 1)),
		);
		setting.addButton((button) =>
			button
				.setButtonText("Move down")
				.setDisabled(index === panels.length - 1)
				.onClick(() => this.movePanel(index, index + 1)),
		);
	}

	private renderRemove(setting: Setting, panel: Panel): void {
		const lastPanel = this.plugin.settings.panels.length === 1;
		setting.setDesc(lastPanel ? REMOVE_SETTING.lastPanel : REMOVE_SETTING.desc);
		setting.addButton((button) =>
			button
				.setButtonText("Remove panel")
				.setDestructive()
				.setDisabled(lastPanel)
				.onClick(() => this.removePanel(panel)),
		);
	}

	private sourceList(panel: Panel): SettingDefinitionList {
		const { sources } = panel;
		return {
			type: "list",
			id: "sources",
			heading: "Sources",
			emptyState: NO_SOURCES,
			addItem: {
				name: "Add a source",
				action: (anchor) => showChoices(anchor, this.sourceChoices(sources)),
			},
			onReorder: (from, to) => {
				moveEntry(sources, from, to);
				this.save();
			},
			onDelete: (index) => {
				sources.splice(index, 1);
				this.save();
			},
			items: sources.map((source, index) => this.sourceRow(sources, source, index)),
		};
	}

	private sourceChoices(sources: Source[]): Choice[] {
		const add = (source: Source) => {
			sources.push(source);
			this.save();
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

	private sourceRow(sources: Source[], source: Source, index: number): SettingDefinition {
		const name = this.sourceName(source);
		if (source.kind === "focused") return { id: source.kind, name, desc: FOCUSED_SOURCE_DESC, render: markSourceRow };
		if (source.kind === "note") {
			const firstWithPath = sources.findIndex((other) => other.kind === "note" && other.path === source.path);
			return {
				id: firstWithPath === index ? `note:${source.path}` : `note:${source.path}:${index}`,
				name,
				desc: this.noteDesc(source.path),
				render: (setting) => {
					markSourceRow(setting);
					setting.setDesc(this.noteDesc(source.path));
				},
			};
		}
		return {
			id: source.kind,
			name,
			desc: this.periodicDesc(source),
			render: (setting) => {
				markSourceRow(setting);
				this.sourceRows.set(source, setting);
				setting.setDesc(this.periodicDesc(source));
				this.addFollowControl(setting, source);
			},
		};
	}

	private noteDesc(path: string): string {
		return this.app.vault.getFileByPath(path) === null ? `${path} is missing from the vault.` : path;
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
					this.save();
				}),
		);
	}

	private periodicDetails(panel: Panel, key: (setting: string) => string): SettingDefinitionItem[] {
		const periodic = panel.sources.filter((source): source is PeriodicSource => isPeriodic(source));
		const missingProviders: SettingDefinition[] = periodic
			.filter((source) => !source.custom)
			.map((source) => ({
				id: `${source.kind}-provider-missing`,
				name: `No plugin provides ${PERIOD_NOTES[source.kind]} notes`,
				desc: this.missingProviderDesc(source.kind),
				searchable: false,
				visible: () => !detectPeriod(source.kind, periodicPlugins(this.app)),
			}));
		const customLocations = periodic.flatMap((source) =>
			source.custom ? [this.customLocationGroup(source, source.custom, key)] : [],
		);
		return [...missingProviders, ...customLocations];
	}

	private customLocationGroup(
		source: PeriodicSource,
		custom: PeriodLocation,
		key: (setting: string) => string,
	): SettingDefinitionGroup {
		return {
			type: "group",
			id: `${source.kind}-location`,
			heading: `${PERIOD_LABELS[source.kind]}: custom folder and format`,
			items: [
				{
					id: "folder",
					name: FOLDER_SETTING.name,
					desc: FOLDER_SETTING.desc,
					control: {
						type: "folder",
						key: this.bind(key(`${source.kind}:folder`), {
							read: () => custom.folder,
							write: (value) => (custom.folder = readText(value)),
						}),
					},
				},
				{
					id: "format",
					name: FORMAT_SETTING.name,
					desc: FORMAT_SETTING.desc,
					render: (setting) => this.renderFormatField(setting, source, custom),
				},
			],
		};
	}

	private renderFormatField(setting: Setting, source: PeriodicSource, custom: PeriodLocation): void {
		setting.setDesc(this.formatDesc(source.kind, custom.format));
		setting.addText((text) =>
			text
				.setPlaceholder(DEFAULT_FORMATS[source.kind])
				.setValue(custom.format)
				.onChange((typed) => {
					custom.format = typed;
					setting.setDesc(this.formatDesc(source.kind, typed));
					this.sourceRows.get(source)?.setDesc(this.periodicDesc(source));
					void this.plugin.saveWithoutRedrawingSettings();
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

	private modeDropdown(
		key: string,
		definition: { name: string; desc: string; options: Record<string, string> },
		binding: Binding,
	): SettingDefinition {
		return {
			id: key,
			name: definition.name,
			desc: definition.desc,
			control: { type: "dropdown", key: this.bind(key, binding), options: definition.options },
		};
	}

	private symbolsField(
		key: string,
		definition: { name: string; desc: string; placeholder: string },
		visible: () => boolean,
		binding: Binding,
	): SettingDefinition {
		return {
			id: key,
			name: definition.name,
			desc: definition.desc,
			visible,
			control: {
				type: "text",
				key: this.bind(key, binding),
				placeholder: definition.placeholder,
				validate: (typed) => symbolListError(typed) ?? undefined,
			},
		};
	}

	private tasksMissingNotice(
		id: string,
		desc: string,
		mode: () => ClosingStatuses | HiddenStatuses,
	): SettingDefinition {
		return {
			id,
			name: TASKS_MISSING_NAME,
			desc,
			searchable: false,
			visible: () => mode() === "tasks-plugin" && !isTasksPluginEnabled(this.app),
		};
	}
}

function isPeriodic(source: Source): source is PeriodicSource {
	return source.kind !== "focused" && source.kind !== "note";
}

function readText(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function markSourceRow(setting: Setting): void {
	setting.settingEl.addClass("task-overview-source-row");
}
