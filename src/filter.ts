import { setIcon, setTooltip } from "obsidian";
import { TaskFilter } from "./tasks";

export interface FilterControlProps {
	container: HTMLElement;
	active: TaskFilter;
	counts: Record<TaskFilter, number>;
	onSelect: (filter: TaskFilter) => void;
}

interface FilterOption {
	filter: TaskFilter;
	icon: string;
	description: string;
}

const FILTER_OPTIONS: FilterOption[] = [
	{ filter: "open", icon: "circle", description: "Open tasks" },
	{ filter: "closed", icon: "check", description: "Completed tasks" },
	{ filter: "all", icon: "list", description: "All tasks" },
];

export function renderFilterControl(props: FilterControlProps): void {
	props.container.empty();

	for (const option of FILTER_OPTIONS) {
		const isSelected = option.filter === props.active;
		const label = `${option.description} (${props.counts[option.filter]})`;

		const button = props.container.createEl("button", {
			cls: ["clickable-icon", "task-overview-filter-option"],
			attr: { type: "button", "aria-label": label, "aria-pressed": String(isSelected) },
		});
		button.toggleClass("is-active", isSelected);

		setIcon(button, option.icon);
		setTooltip(button, label);

		button.addEventListener("click", () => {
			if (isSelected) return;
			props.onSelect(option.filter);
		});
	}
}
