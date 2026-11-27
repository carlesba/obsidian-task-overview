import { ExtraButtonComponent, Platform, Setting, setIcon } from "obsidian";

export interface ListRow {
	name: string;
	desc?: string;
	editLabel?: string;
	onEdit?: () => void;
	addControls?: (setting: Setting) => void;
	addDetails?: (containerEl: HTMLElement, row: Setting) => void;
}

export interface SettingsList {
	containerEl: HTMLElement;
	heading: string;
	addLabel: string;
	emptyText: string;
	rows: ListRow[];
	onAdd: (anchor: HTMLElement) => void;
	onMove: (from: number, to: number) => void;
	onDelete: (index: number) => void;
}

export function moveEntry(entries: unknown[], from: number, to: number): void {
	entries.splice(to, 0, ...entries.splice(from, 1));
}

export function renderSettingsList(list: SettingsList): void {
	const { containerEl, rows } = list;
	new Setting(containerEl)
		.setName(list.heading)
		.setHeading()
		.addExtraButton((button) =>
			button
				.setIcon("plus")
				.setTooltip(list.addLabel)
				.onClick(() => list.onAdd(button.extraSettingsEl)),
		);

	if (!rows.length) {
		new Setting(containerEl).setName(list.emptyText).settingEl.addClass("task-overview-list-placeholder");
		return;
	}

	let dragged: number | undefined;
	rows.forEach((row, index) => {
		const setting = new Setting(containerEl).setName(row.name).setDesc(row.desc ?? "");
		setting.settingEl.addClass("task-overview-list-row");
		const leading = createDiv({ cls: "task-overview-list-row-leading" });
		setting.settingEl.prepend(leading);

		if (Platform.isDesktop) {
			const handle = leading.createDiv({ cls: "task-overview-list-row-handle", attr: { "aria-label": "Drag to reorder" } });
			setIcon(handle, "grip-vertical");
			handle.draggable = true;
			handle.addEventListener("dragstart", (event) => {
				dragged = index;
				event.dataTransfer?.setDragImage(setting.settingEl, 0, 0);
			});
			handle.addEventListener("dragend", () => (dragged = undefined));
			setting.settingEl.addEventListener("dragover", (event) => {
				if (dragged !== undefined) event.preventDefault();
			});
			setting.settingEl.addEventListener("drop", (event) => {
				if (dragged === undefined || dragged === index) return;
				event.preventDefault();
				list.onMove(dragged, index);
			});
		}

		new ExtraButtonComponent(leading)
			.setIcon("chevron-up")
			.setTooltip("Move up")
			.setDisabled(index === 0)
			.onClick(() => list.onMove(index, index - 1));
		new ExtraButtonComponent(leading)
			.setIcon("chevron-down")
			.setTooltip("Move down")
			.setDisabled(index === rows.length - 1)
			.onClick(() => list.onMove(index, index + 1));
		const { onEdit } = row;
		if (onEdit) {
			new ExtraButtonComponent(leading)
				.setIcon("pencil")
				.setTooltip(row.editLabel ?? "Edit")
				.onClick(onEdit);
		}

		row.addControls?.(setting);
		setting.addExtraButton((button) =>
			button
				.setIcon("x")
				.setTooltip("Remove")
				.onClick(() => list.onDelete(index)),
		);
		row.addDetails?.(containerEl, setting);
	});
}
